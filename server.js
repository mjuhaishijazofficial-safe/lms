// Simple LMS: no dependencies. Requires Node 22+ (built-in SQLite).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { AsyncLocalStorage } = require('node:async_hooks');
const als = new AsyncLocalStorage(); // holds the current request path so the sidebar can mark the open page

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const MAX_UPLOAD = 50 * 1024 * 1024;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- database ----------
const db = new DatabaseSync(path.join(DATA_DIR, 'lms.db'));
db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student');
CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS enrollments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, subject_id));
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, material_id));
CREATE TABLE IF NOT EXISTS recents (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  at INTEGER NOT NULL, PRIMARY KEY (user_id, material_id));
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
`);

try { db.exec("ALTER TABLE materials ADD COLUMN chapter TEXT NOT NULL DEFAULT ''"); } catch {}

function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPw(pw, stored) {
  const [salt, hash] = stored.split(':');
  const a = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(a, Buffer.from(hash, 'hex'));
}

if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) {
  const pw = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare("INSERT INTO users (username,name,password,role) VALUES ('admin','Teacher',?, 'admin')").run(hashPw(pw));
  console.log(`First run: created admin account. Username: admin  Password: ${pw}  (change it after login)`);
}

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');

function page(title, user, body) {
  const cur = als.getStore()?.path || '';
  const on = href => href === '/' ? cur === '/' : (cur.startsWith(href) || (href === '/courses' && cur.startsWith('/subject/')));
  const link = (href, label) => `<a href="${href}"${on(href) ? ' class="active"' : ''}>${label}</a>`;
  const items = user?.role === 'student'
    ? link('/', 'Dashboard') + link('/courses', 'My Courses') + link('/subjects', 'Subjects') + link('/recent', 'Recent Materials') + link('/bookmarks', 'Bookmarks') + link('/chat', 'Chat') + link('/profile', 'Profile')
    : link('/', 'Dashboard') + link('/profile', 'Profile');
  const side = user ? `<aside class="side"><div class="brand">StudyHub<small>Learn. Grow. Succeed.</small></div>${items}
<form method="post" action="/logout"><button>Log Out</button></form></aside>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${css}</style></head><body class="${user ? 'with-side' : ''}">${side}<main>${body}</main></body></html>`;
}
function send(res, code, html, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(html);
}
const redirect = (res, to, headers = {}) => { res.writeHead(303, { Location: to, ...headers }); res.end(); };
const notFound = (res, user) => send(res, 404, page('Not found', user, '<h1>Not found</h1>'));

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readForm(req) {
  return Object.fromEntries(new URLSearchParams((await readBody(req, 1e6)).toString()));
}
// Minimal multipart parser: returns { fields, file: {name, data} | null }
async function readMultipart(req) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(req.headers['content-type'] || '');
  if (!m) throw new Error('bad form');
  const body = await readBody(req, MAX_UPLOAD + 1e6);
  const delim = Buffer.from('--' + (m[1] || m[2]));
  const fields = {}; let file = null;
  let pos = body.indexOf(delim);
  while (pos !== -1) {
    const start = pos + delim.length;
    if (body.slice(start, start + 2).toString() === '--') break;
    const next = body.indexOf(delim, start);
    if (next === -1) break;
    const part = body.slice(start + 2, next - 2); // strip CRLF around part
    const split = part.indexOf('\r\n\r\n');
    const head = part.slice(0, split).toString();
    const data = part.slice(split + 4);
    const name = /name="([^"]*)"/.exec(head)?.[1];
    const fname = /filename="([^"]*)"/.exec(head)?.[1];
    if (fname !== undefined) { if (fname) file = { name: fname, data }; } else if (name) fields[name] = data.toString();
    pos = next;
  }
  return { fields, file };
}

const cookieOf = req => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => c.split('=')));
function currentUser(req) {
  const t = cookieOf(req).sid;
  if (!t) return null;
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(t, Date.now()) || null;
}
const fails = new Map(); // ip -> [timestamps]
function tooManyFails(ip) {
  const recent = (fails.get(ip) || []).filter(t => Date.now() - t < 15 * 60e3);
  fails.set(ip, recent);
  return recent.length >= 10;
}

function studentCanSee(user, subjectId) {
  return user.role === 'admin' || !!db.prepare('SELECT 1 FROM enrollments WHERE user_id=? AND subject_id=?').get(user.id, subjectId);
}
function safeUrl(u) {
  try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : null; } catch { return null; }
}

// ---------- views ----------
function loginPage(err = '') {
  return page('Login', null, `<h1>Login</h1>${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="post" action="/login">
<label>Username <input name="username" required autofocus></label>
<label>Password <input name="password" type="password" required></label>
<button>Login</button></form>`);
}

function adminHome(user, msg = '') {
  const students = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM messages m WHERE m.student_id=u.id AND m.sender='student' AND m.seen=0) AS unread
    FROM users u WHERE role='student' ORDER BY name`).all();
  const subjects = db.prepare('SELECT * FROM subjects ORDER BY name').all();
  return page('Admin', user, `<h1>Admin</h1>${msg ? `<p class="err">${esc(msg)}</p>` : ''}
<h2>Students</h2>
<table><tr><th>Name</th><th>Username</th><th>Subjects</th><th>Chat</th><th></th></tr>
${students.map(s => `<tr><td><a href="/admin/students/${s.id}">${esc(s.name)}</a></td><td>${esc(s.username)}</td>
<td>${db.prepare('SELECT COUNT(*) c FROM enrollments WHERE user_id=?').get(s.id).c}</td>
<td><a href="/chat/${s.id}">Open${s.unread ? ` (${s.unread} new)` : ''}</a></td>
<td><form method="post" action="/admin/students/${s.id}/delete" onsubmit="return confirm('Delete ${esc(s.name).replace(/'/g, '')} and their chat? This cannot be undone.')"><button>Delete</button></form></td></tr>`).join('') || '<tr><td colspan="5">No students yet.</td></tr>'}</table>
<h3>Add student</h3>
<form method="post" action="/admin/students/add">
<label>Full name <input name="name" required></label>
<label>Username <input name="username" required></label>
<label>Password <input name="password" required minlength="4"></label>
<button>Add student</button></form>
<h2>Subjects</h2>
<table><tr><th>Subject</th><th></th></tr>
${subjects.map(s => `<tr><td><a href="/admin/subjects/${s.id}">${esc(s.name)}</a></td>
<td><form method="post" action="/admin/subjects/${s.id}/delete" onsubmit="return confirm('Delete this subject and all its material?')"><button>Delete</button></form></td></tr>`).join('') || '<tr><td colspan="2">No subjects yet.</td></tr>'}</table>
<h3>Add subject</h3>
<form method="post" action="/admin/subjects/add"><label>Name <input name="name" required></label><button>Add subject</button></form>`);
}

function adminStudent(user, s, msg = '') {
  const subjects = db.prepare('SELECT sub.*, (SELECT 1 FROM enrollments e WHERE e.user_id=? AND e.subject_id=sub.id) AS has FROM subjects sub ORDER BY name').all(s.id);
  return page(s.name, user, `<h1>${esc(s.name)}</h1><p>Username: ${esc(s.username)}</p>${msg ? `<p class="err">${esc(msg)}</p>` : ''}
<p><a href="/chat/${s.id}">Open chat</a> | <a href="/admin">Back</a></p>
<h2>Subjects assigned</h2>
<form method="post" action="/admin/students/${s.id}/subjects">
${subjects.map(x => `<label class="check"><input type="checkbox" name="subject" value="${x.id}" ${x.has ? 'checked' : ''}> ${esc(x.name)}</label>`).join('') || '<p>No subjects created yet.</p>'}
<button>Save</button></form>
<h2>Reset password</h2>
<form method="post" action="/admin/students/${s.id}/password"><label>New password <input name="password" required minlength="4"></label><button>Set password</button></form>`);
}

function adminSubject(user, sub, msg = '') {
  const mats = db.prepare('SELECT * FROM materials WHERE subject_id=? ORDER BY id').all(sub.id);
  return page(sub.name, user, `<h1>${esc(sub.name)}</h1>${msg ? `<p class="err">${esc(msg)}</p>` : ''}<p><a href="/admin">Back</a></p>
<h2>Material</h2>
<table><tr><th>Chapter</th><th>Title</th><th>Type</th><th></th></tr>
${mats.map(m => `<tr><td>${esc(m.chapter)}</td><td><a href="${m.kind === 'pdf' ? `/file/${m.id}` : esc(m.ref)}" target="_blank" rel="noopener">${esc(m.title)}</a></td><td>${m.kind === 'pdf' ? 'PDF' : 'Video link'}</td>
<td><form method="post" action="/admin/materials/${m.id}/delete" onsubmit="return confirm('Delete this item?')"><button>Delete</button></form></td></tr>`).join('') || '<tr><td colspan="4">Nothing yet.</td></tr>'}</table>
<h3>Upload PDF</h3>
<form method="post" action="/admin/subjects/${sub.id}/pdf" enctype="multipart/form-data">
<label>Chapter <input name="chapter" placeholder="e.g. Chapter 1: Real Numbers"></label><label>Title <input name="title" required></label><label>File <input type="file" name="file" accept="application/pdf,.pdf" required></label><button>Upload</button></form>
<h3>Add video link</h3>
<form method="post" action="/admin/subjects/${sub.id}/link"><label>Chapter <input name="chapter" placeholder="e.g. Chapter 1: Real Numbers"></label><label>Title <input name="title" required></label><label>Link <input name="url" type="url" placeholder="https://" required></label><button>Add link</button></form>`);
}

function matItem(m, user, back) {
  const bm = db.prepare('SELECT 1 FROM bookmarks WHERE user_id=? AND material_id=?').get(user.id, m.id);
  const href = m.kind === 'pdf' ? `/file/${m.id}` : `/go/${m.id}`;
  return `<li><a href="${href}" target="_blank" rel="noopener">${esc(m.title)}</a> (${m.kind === 'pdf' ? 'PDF' : 'video'})
<form method="post" action="/bookmark/${m.id}" class="inline2"><input type="hidden" name="back" value="${esc(back)}"><button>${bm ? 'Remove bookmark' : 'Bookmark'}</button></form></li>`;
}
function groupedList(mats, user, back, tag) {
  const groups = new Map();
  for (const m of mats) { if (!groups.has(m.chapter)) groups.set(m.chapter, []); groups.get(m.chapter).push(m); }
  return [...groups].map(([ch, ms]) => (ch ? `<${tag}>${esc(ch)}</${tag}>` : '') + `<ul>${ms.map(m => matItem(m, user, back)).join('')}</ul>`).join('');
}
const mySubjects = user => db.prepare('SELECT s.* FROM subjects s JOIN enrollments e ON e.subject_id=s.id WHERE e.user_id=? ORDER BY s.name').all(user.id);
const myMaterials = user => `FROM materials m JOIN enrollments e ON e.subject_id=m.subject_id WHERE e.user_id=${Number(user.id)}`;

function studentHome(user) {
  const unread = db.prepare("SELECT COUNT(*) c FROM messages WHERE student_id=? AND sender='admin' AND seen=0").get(user.id).c;
  const recent = db.prepare(`SELECT m.* ${myMaterials(user)} AND m.id IN (SELECT material_id FROM recents WHERE user_id=?) ORDER BY (SELECT at FROM recents r WHERE r.user_id=? AND r.material_id=m.id) DESC LIMIT 5`).all(user.id, user.id);
  const nSub = mySubjects(user).length;
  const nMat = db.prepare(`SELECT COUNT(*) c ${myMaterials(user)}`).get().c;
  return page('Dashboard', user, `<h1>Hi, ${esc(user.name)}</h1>
<p>Subjects: ${nSub} | Materials: ${nMat}</p>
${unread ? `<p><a href="/chat">You have ${unread} new message${unread > 1 ? 's' : ''}</a></p>` : ''}
<h2>Recently opened</h2>
${recent.length ? `<ul>${recent.map(m => matItem(m, user, '/')).join('')}</ul>` : '<p>Nothing opened yet.</p>'}`);
}
function studentCourses(user) {
  const subjects = mySubjects(user);
  return page('My Courses', user, `<h1>My Courses</h1>
${subjects.length ? `<ul>${subjects.map(s => `<li><a href="/subject/${s.id}">${esc(s.name)}</a></li>`).join('')}</ul>` : '<p>No subjects assigned yet.</p>'}`);
}
function studentSubjects(user) {
  const subjects = mySubjects(user);
  return page('Subjects', user, `<h1>Subjects</h1>` + (subjects.map(s => {
    const mats = db.prepare('SELECT * FROM materials WHERE subject_id=? ORDER BY id').all(s.id);
    return `<h2><a href="/subject/${s.id}">${esc(s.name)}</a></h2>${groupedList(mats, user, '/subjects', 'h3') || '<p>No material yet.</p>'}`;
  }).join('') || '<p>No subjects assigned yet.</p>'));
}
function studentRecent(user) {
  const rows = db.prepare(`SELECT m.* ${myMaterials(user)} AND m.id IN (SELECT material_id FROM recents WHERE user_id=?) ORDER BY (SELECT at FROM recents r WHERE r.user_id=? AND r.material_id=m.id) DESC LIMIT 30`).all(user.id, user.id);
  return page('Recent Materials', user, `<h1>Recent Materials</h1>${rows.length ? `<ul>${rows.map(m => matItem(m, user, '/recent')).join('')}</ul>` : '<p>Nothing opened yet.</p>'}`);
}
function studentBookmarks(user) {
  const rows = db.prepare(`SELECT m.* ${myMaterials(user)} AND m.id IN (SELECT material_id FROM bookmarks WHERE user_id=?) ORDER BY m.id`).all(user.id);
  return page('Bookmarks', user, `<h1>Bookmarks</h1>${rows.length ? `<ul>${rows.map(m => matItem(m, user, '/bookmarks')).join('')}</ul>` : '<p>No bookmarks yet.</p>'}`);
}
function profilePage(user) {
  return page('Profile', user, `<h1>Profile</h1><p>Name: ${esc(user.name)}</p><p>Username: ${esc(user.username)}</p>
<h2>Change password</h2>
<form method="post" action="/password"><label>Current password <input type="password" name="old" required></label>
<label>New password <input type="password" name="new" required minlength="4"></label><button>Change</button></form>`);
}

function studentSubject(user, sub) {
  const mats = db.prepare('SELECT * FROM materials WHERE subject_id=? ORDER BY id').all(sub.id);
  return page(sub.name, user, `<h1>${esc(sub.name)}</h1><p><a href="/courses">Back</a></p>${groupedList(mats, user, '/subject/' + sub.id, 'h2') || '<p>No material yet.</p>'}`);
}

function chatMessages(studentId, viewerRole) {
  const other = viewerRole === 'admin' ? 'student' : 'admin';
  db.prepare('UPDATE messages SET seen=1 WHERE student_id=? AND sender=?').run(studentId, other);
  const msgs = db.prepare('SELECT * FROM messages WHERE student_id=? ORDER BY id').all(studentId);
  return msgs.map(m => `<div class="msg ${m.sender === viewerRole ? 'me' : 'them'}"><b>${m.sender === viewerRole ? 'You' : (m.sender === 'admin' ? 'Teacher' : 'Student')}</b>
<span class="time">${new Date(m.at).toLocaleString()}</span><div>${esc(m.body).replace(/\n/g, '<br>')}</div></div>`).join('') || '<p>No messages yet.</p>';
}
function chatPage(user, student) {
  return page('Chat', user, `<h1>Chat${user.role === 'admin' ? ' with ' + esc(student.name) : ''}</h1>
${user.role === 'admin' ? '<p><a href="/admin">Back</a></p>' : ''}
<div id="msgs" class="msgs">${chatMessages(student.id, user.role)}</div>
<form method="post" action="/chat/${student.id}/send"><textarea name="body" rows="3" required maxlength="2000"></textarea><button>Send</button></form>
<script>
const box = document.getElementById('msgs'); box.scrollTop = box.scrollHeight;
setInterval(async () => { try {
  const r = await fetch('/chat/${student.id}/fragment'); if (!r.ok) return;
  const h = await r.text(); if (h !== box.innerHTML) { box.innerHTML = h; box.scrollTop = box.scrollHeight; }
} catch (e) {} }, 5000);
</script>`);
}

// ---------- routing ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const method = req.method;
  const user = currentUser(req);
  let m;

  if (p === '/login') {
    if (method === 'GET') return user ? redirect(res, '/') : send(res, 200, loginPage());
    if (method === 'POST') {
      const ip = req.socket.remoteAddress;
      if (tooManyFails(ip)) return send(res, 429, loginPage('Too many attempts. Try again in 15 minutes.'));
      const f = await readForm(req);
      const u = db.prepare('SELECT * FROM users WHERE username=?').get(f.username || '');
      if (!u || !checkPw(f.password || '', u.password)) {
        fails.get(ip).push(Date.now());
        return send(res, 401, loginPage('Wrong username or password.'));
      }
      const token = crypto.randomBytes(32).toString('hex');
      const days = 30;
      db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, u.id, Date.now() + days * 864e5);
      return redirect(res, '/', { 'Set-Cookie': `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${days * 86400}` });
    }
  }
  if (!user) return redirect(res, '/login');

  if (p === '/logout' && method === 'POST') {
    db.prepare('DELETE FROM sessions WHERE token=?').run(cookieOf(req).sid);
    return redirect(res, '/login', { 'Set-Cookie': 'sid=; Max-Age=0; Path=/' });
  }
  if (p === '/' && method === 'GET') return send(res, 200, user.role === 'admin' ? adminHome(user) : studentHome(user));
  if (p === '/profile' && method === 'GET') return send(res, 200, profilePage(user));

  const studentPages = { '/courses': studentCourses, '/subjects': studentSubjects, '/recent': studentRecent, '/bookmarks': studentBookmarks };
  if (studentPages[p] && method === 'GET') return user.role === 'admin' ? redirect(res, '/') : send(res, 200, studentPages[p](user));

  const touch = (mat) => db.prepare('INSERT OR REPLACE INTO recents VALUES (?,?,?)').run(user.id, mat.id, Date.now());
  if ((m = p.match(/^\/go\/(\d+)$/)) && method === 'GET') {
    const mat = db.prepare("SELECT * FROM materials WHERE id=? AND kind='link'").get(m[1]);
    if (!mat || !studentCanSee(user, mat.subject_id)) return notFound(res, user);
    touch(mat);
    res.writeHead(302, { Location: mat.ref }); return res.end();
  }
  if ((m = p.match(/^\/bookmark\/(\d+)$/)) && method === 'POST') {
    const mat = db.prepare('SELECT * FROM materials WHERE id=?').get(m[1]);
    if (!mat || !studentCanSee(user, mat.subject_id)) return notFound(res, user);
    const back = (await readForm(req)).back || '/';
    if (db.prepare('DELETE FROM bookmarks WHERE user_id=? AND material_id=?').run(user.id, mat.id).changes === 0)
      db.prepare('INSERT INTO bookmarks VALUES (?,?)').run(user.id, mat.id);
    return redirect(res, back.startsWith('/') && !back.startsWith('//') ? back : '/');
  }

  if (p === '/password') {
    const form = (msg = '') => page('Change password', user, `<h1>Change password</h1>${msg ? `<p class="err">${esc(msg)}</p>` : ''}
<form method="post"><label>Current password <input type="password" name="old" required></label>
<label>New password <input type="password" name="new" required minlength="4"></label><button>Change</button></form>`);
    if (method === 'GET') return send(res, 200, form());
    const f = await readForm(req);
    if (!checkPw(f.old || '', user.password)) return send(res, 400, form('Current password is wrong.'));
    if ((f.new || '').length < 4) return send(res, 400, form('New password is too short.'));
    db.prepare('UPDATE users SET password=? WHERE id=?').run(hashPw(f.new), user.id);
    return send(res, 200, page('Done', user, '<p>Password changed.</p><p><a href="/">Home</a></p>'));
  }

  // ----- student pages -----
  if ((m = p.match(/^\/subject\/(\d+)$/)) && method === 'GET') {
    const sub = db.prepare('SELECT * FROM subjects WHERE id=?').get(m[1]);
    if (!sub || !studentCanSee(user, sub.id)) return notFound(res, user);
    return send(res, 200, user.role === 'admin' ? adminSubject(user, sub) : studentSubject(user, sub));
  }
  if ((m = p.match(/^\/file\/(\d+)$/)) && method === 'GET') {
    const mat = db.prepare("SELECT * FROM materials WHERE id=? AND kind='pdf'").get(m[1]);
    if (!mat || !studentCanSee(user, mat.subject_id)) return notFound(res, user);
    const fp = path.join(UPLOAD_DIR, path.basename(mat.ref));
    if (!fs.existsSync(fp)) return notFound(res, user);
    touch(mat);
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline', 'Content-Length': fs.statSync(fp).size, 'X-Content-Type-Options': 'nosniff' });
    return fs.createReadStream(fp).pipe(res);
  }

  // ----- chat -----
  if (p === '/chat' && method === 'GET' && user.role === 'student') return redirect(res, `/chat/${user.id}`);
  if ((m = p.match(/^\/chat\/(\d+)(\/send|\/fragment)?$/))) {
    const sid = Number(m[1]);
    if (user.role === 'student' && sid !== user.id) return notFound(res, user);
    const student = db.prepare("SELECT * FROM users WHERE id=? AND role='student'").get(sid);
    if (!student) return notFound(res, user);
    if (!m[2] && method === 'GET') return send(res, 200, chatPage(user, student));
    if (m[2] === '/fragment' && method === 'GET') return send(res, 200, chatMessages(sid, user.role));
    if (m[2] === '/send' && method === 'POST') {
      const body = ((await readForm(req)).body || '').trim().slice(0, 2000);
      if (body) db.prepare('INSERT INTO messages (student_id,sender,body,at) VALUES (?,?,?,?)').run(sid, user.role, body, new Date().toISOString());
      return redirect(res, `/chat/${sid}`);
    }
  }

  // ----- admin only -----
  if (user.role !== 'admin') return notFound(res, user);

  if (p === '/admin') return redirect(res, '/');

  if (p === '/admin/students/add' && method === 'POST') {
    const f = await readForm(req);
    const name = (f.name || '').trim(), username = (f.username || '').trim(), pw = f.password || '';
    if (!name || !username || pw.length < 4) return send(res, 400, adminHome(user, 'Name, username and a password of 4+ characters are required.'));
    try { db.prepare("INSERT INTO users (username,name,password,role) VALUES (?,?,?,'student')").run(username, name, hashPw(pw)); }
    catch { return send(res, 400, adminHome(user, 'That username already exists.')); }
    return redirect(res, '/');
  }
  if ((m = p.match(/^\/admin\/students\/(\d+)(?:\/(delete|subjects|password))?$/))) {
    const s = db.prepare("SELECT * FROM users WHERE id=? AND role='student'").get(m[1]);
    if (!s) return notFound(res, user);
    if (!m[2] && method === 'GET') return send(res, 200, adminStudent(user, s));
    if (m[2] === 'delete' && method === 'POST') { db.prepare('DELETE FROM users WHERE id=?').run(s.id); return redirect(res, '/'); }
    if (m[2] === 'password' && method === 'POST') {
      const pw = (await readForm(req)).password || '';
      if (pw.length < 4) return send(res, 400, adminStudent(user, s, 'Password must be 4+ characters.'));
      db.prepare('UPDATE users SET password=? WHERE id=?').run(hashPw(pw), s.id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(s.id);
      return send(res, 200, adminStudent(user, s, 'Password updated.'));
    }
    if (m[2] === 'subjects' && method === 'POST') {
      const raw = new URLSearchParams((await readBody(req, 1e6)).toString()).getAll('subject');
      db.prepare('DELETE FROM enrollments WHERE user_id=?').run(s.id);
      const ins = db.prepare('INSERT OR IGNORE INTO enrollments VALUES (?,?)');
      for (const id of raw) if (db.prepare('SELECT 1 FROM subjects WHERE id=?').get(id)) ins.run(s.id, id);
      return send(res, 200, adminStudent(user, s, 'Saved.'));
    }
  }

  if (p === '/admin/subjects/add' && method === 'POST') {
    const name = ((await readForm(req)).name || '').trim();
    if (name) db.prepare('INSERT INTO subjects (name) VALUES (?)').run(name);
    return redirect(res, '/');
  }
  if ((m = p.match(/^\/admin\/subjects\/(\d+)\/(delete|pdf|link)$/)) && method === 'POST') {
    const sub = db.prepare('SELECT * FROM subjects WHERE id=?').get(m[1]);
    if (!sub) return notFound(res, user);
    if (m[2] === 'delete') {
      for (const x of db.prepare("SELECT ref FROM materials WHERE subject_id=? AND kind='pdf'").all(sub.id)) fs.rmSync(path.join(UPLOAD_DIR, path.basename(x.ref)), { force: true });
      db.prepare('DELETE FROM subjects WHERE id=?').run(sub.id);
      return redirect(res, '/');
    }
    if (m[2] === 'link') {
      const f = await readForm(req); const u = safeUrl((f.url || '').trim());
      if (!u || !(f.title || '').trim()) return send(res, 400, adminSubject(user, sub, 'Enter a title and a valid http(s) link.'));
      db.prepare("INSERT INTO materials (subject_id,title,kind,ref,chapter) VALUES (?,?,'link',?,?)").run(sub.id, f.title.trim(), u, (f.chapter || '').trim());
      return redirect(res, `/subject/${sub.id}`);
    }
    if (m[2] === 'pdf') {
      let up;
      try { up = await readMultipart(req); } catch { return send(res, 400, adminSubject(user, sub, 'Upload failed (file too large? limit is 50 MB).')); }
      const title = (up.fields.title || '').trim();
      if (!title || !up.file) return send(res, 400, adminSubject(user, sub, 'Enter a title and choose a file.'));
      if (up.file.data.slice(0, 5).toString() !== '%PDF-') return send(res, 400, adminSubject(user, sub, 'That file is not a PDF.'));
      const name = crypto.randomBytes(16).toString('hex') + '.pdf';
      fs.writeFileSync(path.join(UPLOAD_DIR, name), up.file.data);
      db.prepare("INSERT INTO materials (subject_id,title,kind,ref,chapter) VALUES (?,?,'pdf',?,?)").run(sub.id, title, name, (up.fields.chapter || '').trim());
      return redirect(res, `/subject/${sub.id}`);
    }
  }
  if ((m = p.match(/^\/admin\/subjects\/(\d+)$/)) && method === 'GET') return redirect(res, `/subject/${m[1]}`);
  if ((m = p.match(/^\/admin\/materials\/(\d+)\/delete$/)) && method === 'POST') {
    const mat = db.prepare('SELECT * FROM materials WHERE id=?').get(m[1]);
    if (!mat) return notFound(res, user);
    if (mat.kind === 'pdf') fs.rmSync(path.join(UPLOAD_DIR, path.basename(mat.ref)), { force: true });
    db.prepare('DELETE FROM materials WHERE id=?').run(mat.id);
    return redirect(res, `/subject/${mat.subject_id}`);
  }

  return notFound(res, user);
}

http.createServer((req, res) => {
  als.run({ path: new URL(req.url, 'http://x').pathname }, () => handle(req, res)).catch(err => {
    console.error(err);
    if (!res.headersSent) send(res, 500, page('Error', null, '<h1>Something went wrong</h1><p><a href="/">Home</a></p>'));
  });
}).listen(PORT, () => console.log(`LMS running at http://localhost:${PORT}`));
