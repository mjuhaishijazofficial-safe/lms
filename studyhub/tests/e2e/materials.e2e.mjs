// Phase 3 end-to-end test: material management, uploads, and download authorization.
// Needs the app running (default http://localhost:3200) and must be started from the project root (it inspects ./storage).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const B = process.argv[2] ?? "http://localhost:3200";
const STORAGE = join(process.cwd(), "storage");
const P = "SmokeTest";
const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD;
if (!ADMIN_PW) { console.error("Run with the .env loaded:  node --env-file=.env <this file>"); process.exit(1); }
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && extra ? "   -> " + extra : ""}`); if (!ok) fails++; };
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html) => dec(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
const files = () => (existsSync(STORAGE) ? readdirSync(STORAGE).sort() : []);

class Jar {
  c = new Map();
  store(res) { for (const h of res.headers.getSetCookie()) { const [kv] = h.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (v === "" || /max-age=0|expires=thu, 01 jan 1970/i.test(h)) this.c.delete(k); else this.c.set(k, v); } }
  get header() { return [...this.c].map(([k, v]) => `${k}=${v}`).join("; "); }
}
const get = async (path, jar) => { const r = await fetch(B + path, { redirect: "manual", headers: { cookie: jar?.header ?? "" } }); jar?.store(r); return r; };
const loc = (r) => (r.headers.get("location") ?? "").replace(B, "");

async function submit(path, jar, pick, fields = {}, { rawHtml } = {}) {
  const html = rawHtml ?? await (await get(path, jar)).text();
  const forms = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map((m) => m[1]);
  const body = forms.find((f) => f.includes("$ACTION_") && pick(f));
  if (!body) throw new Error(`form not found on ${path}`);
  const fd = new FormData();
  for (const m of body.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g)) {
    const n = /name="([^"]*)"/.exec(m[0])?.[1], v = /value="([^"]*)"/.exec(m[0])?.[1] ?? "";
    if (n) fd.append(dec(n), dec(v));
  }
  for (const [k, v] of Object.entries(fields)) { fd.delete(k); fd.append(k, v); }
  const res = await fetch(B + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: jar.header, origin: B } });
  jar.store(res); return res;
}
const hasField = (name) => (f) => new RegExp(`name="${name}"`).test(f);
const hidden = (name, value) => (f) => new RegExp(`name="${name}"[^>]*value="${value}"`).test(f) || new RegExp(`value="${value}"[^>]*name="${name}"`).test(f);
const login = (jar, email, password) => submit("/login", jar, hasField("email"), { email, password });

// ---- file fixtures -------------------------------------------------------------------------------------------
const enc = (s) => new TextEncoder().encode(s);
const PDF_BYTES = enc("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% smoke test document\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const PDF2_BYTES = enc("%PDF-1.4\n% a different, replacement document\n%%EOF\n");
const DOCX_BYTES = Uint8Array.from(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml\0word/document.xml\0hello docx")]));
const file = (bytes, name, type = "application/octet-stream") => new File([bytes], name, { type });
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const admin = new Jar();
await login(admin, "admin@studyhub.local", ADMIN_PW);
const pageText = async (path, jar = admin) => text(await (await get(path, jar)).text());

// ---- library scaffolding: two classes, each with a subject and a chapter -------------------------------------
async function scaffold(label) {
  await submit("/admin/courses/new", admin, hasField("name"), { name: `${P} ${label}`, description: "", status: "PUBLISHED" });
  const cid = (await (await get("/admin/courses", admin)).text()).match(new RegExp(`href="/admin/courses/([a-z0-9]+)"[^>]*>${P} ${label}<`))?.[1];
  await submit(`/admin/courses/${cid}`, admin, hasField("count"), { count: "1" }); // every course needs a semester now
  const semesterId = (await (await get(`/admin/courses/${cid}`, admin)).text()).match(/id="sem-([a-z0-9]+)"/)?.[1];
  await submit("/admin/subjects/new", admin, hasField("name"), { courseId: cid, semesterId, name: `${P} ${label} Maths`, description: "", icon: "calculator", status: "PUBLISHED" });
  const sid = (await (await get(`/admin/subjects?course=${cid}`, admin)).text()).match(/href="\/admin\/subjects\/([a-z0-9]+)"/)?.[1];
  for (const n of [1, 2]) await submit("/admin/chapters/new", admin, hasField("title"), { subjectId: sid, chapterNumber: String(n), title: `${P} ${label} Chapter ${n}`, description: "", status: "PUBLISHED" });
  const html = await (await get(`/admin/chapters?subject=${sid}`, admin)).text();
  const chapters = [...html.matchAll(/href="\/admin\/chapters\/([a-z0-9]+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
  return { cid, sid, ch1: chapters[0], ch2: chapters[1] };
}
const A = await scaffold("Alpha");
const Bc = await scaffold("Beta");
check("scaffolding: 2 classes with subject + 2 chapters each", [A.cid, A.sid, A.ch1, A.ch2, Bc.cid, Bc.sid, Bc.ch1, Bc.ch2].every(Boolean));

async function makeStudent(name, email, courseId, { changePw = true } = {}) {
  await submit("/admin/students/new", admin, hasField("email"), { name: `${P} ${name}`, email, studentId: "", courseId, status: "ACTIVE", password: "Temp-pass-001" });
  const jar = new Jar(); await login(jar, email, "Temp-pass-001");
  if (changePw) await submit("/change-password", jar, hasField("current"), { current: "Temp-pass-001", password: "Student-pass-123", confirm: "Student-pass-123" });
  const id = (await (await get(`/admin/students?q=${email}`, admin)).text()).match(/href="\/admin\/students\/(c[a-z0-9]{20,})"/)?.[1]; // a cuid, not the "New student" link
  return { jar, id };
}
const s1 = await makeStudent("Ali", "smoketest.mat.ali", A.cid);       // class Alpha
const s2 = await makeStudent("Bea", "smoketest.mat.bea", Bc.cid);      // class Beta
const s3 = await makeStudent("Cy", "smoketest.mat.cy", A.cid, { changePw: false }); // Alpha, but hasn't chosen a password yet
check("students created (Alpha, Beta, and one with a pending password change)", !!s1.id && !!s2.id && !!s3.id);

// ---- access to the admin pages -------------------------------------------------------------------------------
{ const r = await get("/admin/materials", null); check("signed-out /admin/materials -> /login", loc(r) === "/login", `${r.status} ${loc(r)}`); }
for (const p of ["/admin/materials", "/admin/materials/new"]) { const r = await get(p, s1.jar); check(`student blocked from ${p}`, r.status === 307 && loc(r) === "/dashboard", `${r.status} ${loc(r)}`); }
{ const t = await pageText("/admin/materials"); check("materials page has filters and the empty/list state", t.includes("Materials")); }

// ---- create: FILE -------------------------------------------------------------------------------------------
const before = files();
const NEW = (fields, extra) => submit("/admin/materials/new", admin, hasField("title"), { status: "PUBLISHED", description: "", ...fields }, extra);
let pdfId, pdfKey;
{ const r = await NEW({ type: "FILE", chapterId: A.ch1, title: `${P} Chapter 1 Notes`, description: "Complete notes", file: file(PDF_BYTES, "Chapter 1 Notes.pdf", "application/pdf") });
  check("file: create PDF -> redirect with notice", loc(r) === `/admin/materials?chapter=${A.ch1}&notice=material-created`, `${r.status} ${loc(r)}`);
  const now = files(); const added = now.filter((f) => !before.includes(f));
  pdfKey = added[0];
  check("file: stored on disk under a random 48-hex key, not the uploaded name", added.length === 1 && /^[a-f0-9]{48}\.pdf$/.test(pdfKey), added.join());
  const html = await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text();
  pdfId = html.match(/href="\/admin\/materials\/([a-z0-9]+)"[^>]*>SmokeTest Chapter 1 Notes</)?.[1];
  check("file: listed with original name and size", !!pdfId && text(html).includes("Chapter 1 Notes.pdf")); }

// ---- HTML study guide: uploaded as it is, shown to students inside a sandbox ------------------------------------
{ const GUIDE = `<!DOCTYPE html>\n<html><head><title>Guide</title><style>h1{color:#6C4AB6}</style></head><body><h1>Lesson 1</h1><div id="mcqList"></div>\n<script>const mcqs = [{q:"2+2?",o:["3","4"],c:1,e:"Basic sums."}]; document.getElementById("mcqList").textContent = mcqs[0].q;</script></body></html>`;
  const n = files().length;
  const r = await NEW({ type: "FILE", chapterId: A.ch1, title: `${P} HTML Guide`, file: file(enc(GUIDE), "PSY101_Lesson 1.html", "text/html") });
  check("html guide: accepted as a file material", loc(r).endsWith("notice=material-created") && files().length === n + 1, `${r.status} ${loc(r)}`);
  check("html guide: stored under a random key ending .html", /^[a-f0-9]{48}\.html$/.test(files().filter((f) => f.endsWith(".html")).at(-1) ?? ""));
  const listHtml = await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text();
  const guideId = listHtml.match(/href="\/admin\/materials\/([a-z0-9]+)"[^>]*>SmokeTest HTML Guide</)?.[1];
  check("html guide: listed", !!guideId);

  const page = await (await get(`/materials/${guideId}`, s1.jar)).text();
  check("html guide: the student page shows it inside a sandboxed frame",
    new RegExp(`<iframe[^>]*src="/api/materials/${guideId}/file"`).test(page) && /<iframe[^>]*sandbox="allow-scripts allow-popups"/.test(page), page.match(/<iframe[^>]*>/)?.[0]);
  const res = await get(`/api/materials/${guideId}/file`, s1.jar);
  const csp = res.headers.get("content-security-policy") ?? "";
  check("html guide: served inline as HTML", res.status === 200 && (res.headers.get("content-type") ?? "").startsWith("text/html") && (res.headers.get("content-disposition") ?? "").startsWith("inline"), `${res.status} ${res.headers.get("content-type")} ${res.headers.get("content-disposition")}`);
  check("html guide: locked in a sandbox (own origin, no network, framed only by StudyHub)",
    /sandbox allow-scripts/.test(csp) && !/allow-same-origin/.test(csp) && /default-src 'none'/.test(csp) && /frame-ancestors 'self'/.test(csp) && res.headers.get("x-content-type-options") === "nosniff", csp);
  check("html guide: the file is served byte for byte", (await res.text()) === GUIDE);
  { const r2 = await get(`/api/materials/${guideId}/file`, s2.jar); check("html guide: a student of another program can't open it", r2.status === 403, String(r2.status)); }
  { const subj = await (await get(`/subjects/${A.sid}`, s1.jar)).text();
    check("html guide: its card says Study (opens in StudyHub), not Download", !subj.includes(`/api/materials/${guideId}/file?download=1`) && subj.includes(`href="/materials/${guideId}"`)); }

  // Then remove it again, so the rest of this suite sees the chapter exactly as before.
  const del = await submit(`/admin/materials?chapter=${A.ch1}`, admin, (f) => hidden("id", guideId)(f) && !f.includes('name="status"') && !f.includes('name="direction"'), {}, { rawHtml: listHtml });
  check("html guide: deleted again (file removed too)", loc(del).includes("notice=material-deleted") && files().length === n, loc(del)); }

// ---- create: FILE rejections ---------------------------------------------------------------------------------
async function expectRejected(label, fields, needle) {
  const n = files().length;
  const r = await NEW({ type: "FILE", chapterId: A.ch1, title: `${P} Reject ${label}`, ...fields });
  const t = r.status === 200 ? text(await r.text()) : "";
  check(`file rejected: ${label}`, r.status === 200 && t.toLowerCase().includes(needle.toLowerCase()) && files().length === n, `${r.status} ${loc(r)} :: ${t.match(new RegExp(`.{0,60}${needle}.{0,40}`, "i"))?.[0] ?? t.slice(0, 120)}`);
}
await expectRejected("no file chosen", { file: file(new Uint8Array(0), "") }, "Choose a file");
await expectRejected("empty file", { file: file(new Uint8Array(0), "empty.pdf") }, "Choose a file"); // browsers send empty parts as "no file"
await expectRejected(".exe extension", { file: file(enc("MZ\x90\x00"), "setup.exe") }, "isn't allowed");
await expectRejected("executable renamed to .pdf", { file: file(Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0]), "notes.pdf", "application/pdf") }, "don't match");
await expectRejected("HTML renamed to .pdf", { file: file(enc("<html><script>alert(1)</script></html>"), "notes.pdf", "application/pdf") }, "don't match");
await expectRejected("shell script renamed to .docx", { file: file(enc("#!/bin/sh\nrm -rf /\n"), "notes.docx") }, "don't match");
await expectRejected("plain text named .html", { file: file(enc("just my notes, not a web page"), "notes.html", "text/html") }, "don't match");
await expectRejected("SVG image",{ file: file(enc("<svg xmlns='http://www.w3.org/2000/svg'/>"), "x.svg", "image/svg+xml") }, "isn't allowed");
await expectRejected("double extension", { file: file(PDF_BYTES, "notes.pdf.exe") }, "isn't allowed");
await expectRejected("pdf content with a .docx name", { file: file(PDF_BYTES, "notes.docx") }, "don't match");
{ const big = new Uint8Array(51 * 1024 * 1024); big.set(PDF_BYTES);
  await expectRejected("51 MB file (limit is 50 MB)", { file: file(big, "big.pdf", "application/pdf") }, "too large"); }
{ const n = files().length;
  const huge = new Uint8Array(62 * 1024 * 1024); huge.set(PDF_BYTES);
  let status = "network-error";
  try { const r = await NEW({ type: "FILE", chapterId: A.ch1, title: `${P} Reject huge`, file: file(huge, "huge.pdf", "application/pdf") }); status = r.status; } catch { /* connection closed by the server */ }
  check("62 MB body (above the framework limit) is refused and nothing is stored", files().length === n && status !== 303, `status ${status}`); }
{ const r = await get("/admin/materials", admin); check("...and the app still works afterwards", r.status === 200); }

// ---- create: DOCX --------------------------------------------------------------------------------------------
let docxId;
{ const r = await NEW({ type: "FILE", chapterId: A.ch1, title: `${P} Worksheet`, file: file(DOCX_BYTES, "Worksheet.docx") });
  check("file: create DOCX", loc(r).endsWith("notice=material-created"), `${r.status} ${loc(r)}`);
  docxId = (await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text()).match(/href="\/admin\/materials\/([a-z0-9]+)"[^>]*>SmokeTest Worksheet</)?.[1]; }

// ---- create: YOUTUBE -----------------------------------------------------------------------------------------
let ytId;
{ const r = await NEW({ type: "YOUTUBE", chapterId: A.ch1, title: `${P} Intro Video`, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ?si=abc", duration: "24:15" });
  check("youtube: create from a youtu.be link with duration", loc(r).endsWith("notice=material-created"), `${r.status} ${loc(r)}`);
  ytId = (await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text()).match(/href="\/admin\/materials\/([a-z0-9]+)"[^>]*>SmokeTest Intro Video</)?.[1];
  const edit = await (await get(`/admin/materials/${ytId}`, admin)).text();
  check("youtube: stored as the video id, shown normalised, duration kept", edit.includes("watch?v=dQw4w9WgXcQ") && text(edit).includes("24:15") || /value="24:15"/.test(edit));
  check("youtube: admin preview embeds the privacy-friendly player", edit.includes("youtube-nocookie.com/embed/dQw4w9WgXcQ")); }
for (const [label, url, needle] of [["not a youtube link", "https://vimeo.com/123456789", "valid YouTube"], ["lookalike host", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "valid YouTube"], ["javascript: url", "javascript:alert(1)", "valid YouTube"], ["bad id", "https://youtu.be/short", "valid YouTube"]]) {
  const r = await NEW({ type: "YOUTUBE", chapterId: A.ch1, title: `${P} Bad ${label}`, youtubeUrl: url, duration: "" });
  check(`youtube rejected: ${label}`, r.status === 200 && text(await r.text()).includes(needle), `${r.status} ${loc(r)}`);
}
{ const r = await NEW({ type: "YOUTUBE", chapterId: A.ch1, title: `${P} Bad duration`, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", duration: "99:99:99" });
  check("youtube rejected: malformed duration", r.status === 200 && text(await r.text()).includes("minutes:seconds"), `${r.status}`); }
for (const [label, url] of [["watch?v=", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"], ["embed", "https://www.youtube.com/embed/dQw4w9WgXcQ"], ["shorts", "https://www.youtube.com/shorts/dQw4w9WgXcQ"]]) {
  const r = await NEW({ type: "YOUTUBE", chapterId: A.ch2, title: `${P} YT ${label}`, youtubeUrl: url, duration: "" });
  check(`youtube accepted: ${label} form`, loc(r).endsWith("notice=material-created"), `${r.status} ${loc(r)}`);
}

// ---- create: LINK --------------------------------------------------------------------------------------------
let linkId;
{ const r = await NEW({ type: "LINK", chapterId: A.ch1, title: `${P} Practice Site`, externalUrl: "https://www.khanacademy.org/math" });
  check("link: create", loc(r).endsWith("notice=material-created"), `${r.status} ${loc(r)}`);
  linkId = (await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text()).match(/href="\/admin\/materials\/([a-z0-9]+)"[^>]*>SmokeTest Practice Site</)?.[1]; }
for (const [label, url] of [["javascript:", "javascript:alert(document.cookie)"], ["data:", "data:text/html,<script>alert(1)</script>"], ["file:", "file:///etc/passwd"], ["no scheme", "khanacademy.org"], ["credentials", "https://user:pw@example.com"]]) {
  const r = await NEW({ type: "LINK", chapterId: A.ch1, title: `${P} Bad link ${label}`, externalUrl: url });
  check(`link rejected: ${label}`, r.status === 200 && text(await r.text()).includes("full web address"), `${r.status} ${loc(r)}`);
}

// ---- create: TEXT (XSS) --------------------------------------------------------------------------------------
let noteId;
{ const evil = '<h2>Formulae</h2><p>Area = <strong>πr²</strong></p><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">click</a><iframe src="https://evil.example"></iframe><p onclick="alert(4)">safe text</p>';
  const r = await NEW({ type: "TEXT", chapterId: A.ch1, title: `${P} Formula Note`, textContent: evil });
  check("note: create", loc(r).endsWith("notice=material-created"), `${r.status} ${loc(r)}`);
  noteId = (await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text()).match(/href="\/admin\/materials\/([a-z0-9]+)"[^>]*>SmokeTest Formula Note</)?.[1];
  const html = await (await get(`/admin/materials/${noteId}`, admin)).text();
  const saved = dec(/name="textContent"[^>]*value="([^"]*)"/.exec(html)?.[1] ?? /value="([^"]*)"[^>]*name="textContent"/.exec(html)?.[1] ?? "");
  check("note: saved HTML keeps formatting", saved.includes("<h2>Formulae</h2>") && saved.includes("<strong>πr²</strong>"), saved.slice(0, 200));
  check("note: scripts, handlers, iframes and javascript: links are stripped before saving", !/<script|onerror|onclick|javascript:|<iframe|<img/i.test(saved), saved); }
{ const r = await NEW({ type: "TEXT", chapterId: A.ch1, title: `${P} Empty note`, textContent: "<p> </p><p>&nbsp;</p>" });
  check("note rejected when empty after formatting is stripped", r.status === 200 && text(await r.text()).includes("Write something"), `${r.status}`); }

// ---- general validation --------------------------------------------------------------------------------------
{ const r = await NEW({ type: "LINK", chapterId: A.ch1, title: "   ", externalUrl: "https://example.com" }); check("empty title rejected", r.status === 200 && text(await r.text()).includes("Title is required")); }
{ const r = await NEW({ type: "LINK", chapterId: "clxxxxxxxxxxxxxxxxxxxxxxx", title: `${P} Ghost`, externalUrl: "https://example.com" }); check("nonexistent chapter rejected", r.status === 200 && text(await r.text()).includes("Choose a chapter that exists")); }
{ const r = await NEW({ type: "LINK", chapterId: "not-an-id", title: `${P} Ghost`, externalUrl: "https://example.com" }); check("malformed chapter id rejected", r.status === 200); }
{ const r = await NEW({ type: "EXE", chapterId: A.ch1, title: `${P} Ghost` }); check("unknown material type rejected", r.status === 200); }
{ const t = await pageText("/admin/materials?q=" + P + "%20Ghost"); check("none of the rejected inputs created a material", !t.includes(`${P} Ghost`) && !(await pageText(`/admin/materials?q=${P}%20Reject`)).includes(`${P} Reject`) && !(await pageText(`/admin/materials?q=${P}%20Bad`)).includes(`${P} Bad`)); }

// ---- list: filters, search, sort, pagination -----------------------------------------------------------------
for (let i = 1; i <= 22; i++) await NEW({ type: "LINK", chapterId: Bc.ch1, title: `${P} Bulk ${String(i).padStart(2, "0")}`, externalUrl: `https://example.com/${i}` });
{ const p1 = await pageText(`/admin/materials?chapter=${Bc.ch1}`), p2 = await pageText(`/admin/materials?chapter=${Bc.ch1}&page=2`);
  check("pagination: 22 items -> 20 on page 1, 2 on page 2", /Showing 1\s*.\s*20 of 22/.test(p1) && /Showing 21\s*.\s*22 of 22/.test(p2), p1.match(/Showing[^N]{0,25}/)?.[0]); }
{ const t = await pageText(`/admin/materials?q=formula`); check("search by title", t.includes(`${P} Formula Note`) && !t.includes(`${P} Worksheet`)); }
{ const t = await pageText(`/admin/materials?q=complete%20notes`); check("search matches descriptions too", t.includes(`${P} Chapter 1 Notes`)); }
{ const t = await pageText(`/admin/materials?course=${A.cid}&type=YOUTUBE`); check("filter: class + type", t.includes(`${P} Intro Video`) && !t.includes(`${P} Worksheet`) && !t.includes(`${P} Bulk`)); }
{ const t = await pageText(`/admin/materials?subject=${Bc.sid}`); check("filter: subject", t.includes(`${P} Bulk`) && !t.includes(`${P} Intro Video`)); }
{ const t = await pageText(`/admin/materials?chapter=${A.ch2}`); check("filter: chapter", t.includes("YT embed") && !t.includes(`${P} Intro Video`)); }
{ const html = await (await get(`/admin/materials?chapter=${A.ch1}&sort=title`, admin)).text();
  const titles = [...html.matchAll(/href="\/admin\/materials\/[a-z0-9]+"[^>]*>SmokeTest ([^<]+)</g)].map((m) => m[1]);
  check("sort: title A-Z", titles.join("|") === [...titles].sort((a, b) => a.localeCompare(b)).join("|") && titles.length >= 5, titles.join(", ")); }
{ const html = await (await get(`/admin/materials?chapter=${A.ch1}&sort=newest`, admin)).text();
  const titles = [...html.matchAll(/href="\/admin\/materials\/[a-z0-9]+"[^>]*>SmokeTest ([^<]+)</g)].map((m) => m[1]);
  check("sort: newest first", titles[0] === "Formula Note", titles.join(", ")); }
{ const r = await get("/admin/materials?type=EVIL&status=WHATEVER&sort=%3Bdrop&page=-3&chapter=%27--", admin); check("junk query parameters are ignored safely", r.status === 200, String(r.status)); }
{ const t = await pageText("/admin"); check("dashboard shows recent uploads and the materials count", t.includes("Recent uploads") && /Study materials\s+\d+/.test(t) && !t.includes("No study material yet")); }

// ---- reorder -------------------------------------------------------------------------------------------------
{ const order = async () => [...(await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text()).matchAll(/href="\/admin\/materials\/[a-z0-9]+"[^>]*>SmokeTest ([^<]+)</g)].map((m) => m[1]);
  const first = await order();
  const html = await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text();
  const secondId = html.match(new RegExp(`href="/admin/materials/([a-z0-9]+)"[^>]*>SmokeTest ${first[1]}<`))?.[1];
  await submit(`/admin/materials?chapter=${A.ch1}`, admin, (f) => hidden("id", secondId)(f) && hidden("direction", "up")(f), {}, { rawHtml: html });
  const after = await order();
  check("reorder: move up swaps the two materials", after[0] === first[1] && after[1] === first[0], `${first.join(", ")} -> ${after.join(", ")}`);
  const html2 = await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text();
  await submit(`/admin/materials?chapter=${A.ch1}`, admin, (f) => hidden("id", secondId)(f) && hidden("direction", "down")(f), {}, { rawHtml: html2 });
  check("reorder: move down restores it", (await order()).join() === first.join()); }

// ---- download authorisation ----------------------------------------------------------------------------------
const dl = async (id, jar, q = "") => { const r = await fetch(`${B}/api/materials/${id}/file${q}`, { headers: { cookie: jar?.header ?? "" }, redirect: "manual" }); return { r, body: new Uint8Array(await r.arrayBuffer()) }; };
const jsonErr = (x) => { try { return JSON.parse(Buffer.from(x.body).toString()).error; } catch { return ""; } };
{ const x = await dl(pdfId, null); check("download: signed-out -> 401", x.r.status === 401 && jsonErr(x).includes("sign in"), String(x.r.status)); }
{ const x = await dl(pdfId, admin);
  const cd = x.r.headers.get("content-disposition") ?? "";
  check("download: admin gets the exact bytes that were uploaded", x.r.status === 200 && same(x.body, PDF_BYTES));
  check("download: PDF opens inline with the original file name", x.r.headers.get("content-type") === "application/pdf" && cd.startsWith("inline") && cd.includes("Chapter 1 Notes.pdf"), cd);
  check("download: nosniff + private no-store headers", x.r.headers.get("x-content-type-options") === "nosniff" && /no-store/.test(x.r.headers.get("cache-control") ?? "")); }
{ const x = await dl(pdfId, admin, "?download=1"); check("download: ?download=1 forces attachment", (x.r.headers.get("content-disposition") ?? "").startsWith("attachment")); }
{ const x = await dl(docxId, admin);
  check("download: DOCX is an attachment with the Word MIME type", x.r.status === 200 && (x.r.headers.get("content-disposition") ?? "").startsWith("attachment") && x.r.headers.get("content-type")?.includes("wordprocessingml") && same(x.body, DOCX_BYTES)); }
{ const x = await dl(pdfId, s1.jar); check("download: enrolled student (Alpha) gets the file", x.r.status === 200 && same(x.body, PDF_BYTES), String(x.r.status)); }
{ const x = await dl(pdfId, s2.jar); check("download: student from another class (Beta) -> 403 with the permission message", x.r.status === 403 && jsonErr(x) === "You don't have permission to access this material.", `${x.r.status} ${jsonErr(x)}`);
  check("...and no file bytes leak in the 403 body", !Buffer.from(x.body).includes("%PDF")); }
{ const x = await dl(pdfId, s3.jar); check("download: student who must change their password first -> 403", x.r.status === 403 && jsonErr(x).includes("change your password"), `${x.r.status} ${jsonErr(x)}`); }
for (const [label, id] of [["TEXT note (no file)", noteId], ["LINK (no file)", linkId], ["malformed id", "not-an-id"], ["well-formed unknown id", "clxxxxxxxxxxxxxxxxxxxxxxx"], ["path traversal", "..%2F..%2F.env"]]) {
  const x = await dl(id, admin); check(`download: ${label} -> 404`, x.r.status === 404, String(x.r.status));
}

// publish chain: the student loses access as soon as anything above the file is unpublished
const setStatus = async (listPath, id, status) => { const html = await (await get(listPath, admin)).text(); await submit(listPath, admin, (f) => hidden("id", id)(f) && hidden("status", status)(f), {}, { rawHtml: html }); };
async function chainCheck(label, listPath, id) {
  await setStatus(listPath, id, "ARCHIVED");
  const hidden403 = (await dl(pdfId, s1.jar)).r.status;
  const adminStill = (await dl(pdfId, admin)).r.status;
  await setStatus(listPath, id, "PUBLISHED");
  const back = (await dl(pdfId, s1.jar)).r.status;
  check(`publish chain: archiving the ${label} hides the file from the student (admin unaffected), restoring brings it back`, hidden403 === 403 && adminStill === 200 && back === 200, `student ${hidden403}, admin ${adminStill}, restored ${back}`);
}
await chainCheck("material", `/admin/materials?chapter=${A.ch1}`, pdfId);
await chainCheck("chapter", `/admin/chapters?subject=${A.sid}`, A.ch1);
await chainCheck("subject", `/admin/subjects?course=${A.cid}`, A.sid);
{ // A program's status is chosen on its Edit page (the Programs page is cards, without per-row status buttons).
  const edit = `/admin/courses/${A.cid}/edit`;
  const html = await (await get(edit, admin)).text();
  const nameTag = html.match(/<input[^>]*name="name"[^>]*>/)?.[0] ?? "";
  const name = dec(/value="([^"]*)"/.exec(nameTag)?.[1] ?? "");
  const setProgram = (status) => submit(edit, admin, (f) => hidden("id", A.cid)(f) && hasField("name")(f), { name, description: "", status });
  await setProgram("ARCHIVED");
  const hidden403 = (await dl(pdfId, s1.jar)).r.status;
  const adminStill = (await dl(pdfId, admin)).r.status;
  await setProgram("PUBLISHED");
  const back = (await dl(pdfId, s1.jar)).r.status;
  check("publish chain: archiving the program hides the file from the student (admin unaffected), restoring brings it back", !!name && hidden403 === 403 && adminStill === 200 && back === 200, `name "${name}", student ${hidden403}, admin ${adminStill}, restored ${back}`); }
{ // DRAFT is chosen in the edit form (the row button only toggles publish/archive)
  const setViaForm = (status) => submit(`/admin/materials/${pdfId}`, admin, hasField("title"), { title: `${P} Chapter 1 Notes`, description: "Complete notes", chapterId: A.ch1, status, file: file(new Uint8Array(0), "") });
  await setViaForm("DRAFT");
  const draft = (await dl(pdfId, s1.jar)).r.status;
  await setViaForm("PUBLISHED");
  check("publish chain: a draft material is hidden from students, publishing restores it", draft === 403 && (await dl(pdfId, s1.jar)).r.status === 200, `draft ${draft}`); }
{ // moving the student to another class removes access immediately
  await submit(`/admin/students/${s1.id}`, admin, hasField("studentId"), { name: `${P} Ali`, email: "smoketest.mat.ali", studentId: "", courseId: Bc.cid, status: "ACTIVE" });
  const moved = (await dl(pdfId, s1.jar)).r.status;
  await submit(`/admin/students/${s1.id}`, admin, hasField("studentId"), { name: `${P} Ali`, email: "smoketest.mat.ali", studentId: "", courseId: A.cid, status: "ACTIVE" });
  check("moving a student to another class removes access at once (and back restores it)", moved === 403 && (await dl(pdfId, s1.jar)).r.status === 200, `moved ${moved}`); }
{ const html = await (await get("/admin/students", admin)).text();
  await submit("/admin/students", admin, (f) => hidden("id", s2.id)(f) && hidden("status", "INACTIVE")(f), {}, { rawHtml: html });
  const x = await dl(pdfId, s2.jar); check("download: deactivated student -> 401 immediately", x.r.status === 401, String(x.r.status)); }

// students cannot use admin actions on materials
{ const adminHtml = await (await get("/admin/materials/new", admin)).text();
  const r = await submit("/admin/materials/new", s1.jar, hasField("title"), { type: "LINK", chapterId: A.ch1, title: `${P} Hacked`, externalUrl: "https://example.com", status: "PUBLISHED", description: "" }, { rawHtml: adminHtml });
  check("student replaying the create-material action creates nothing", !(await pageText(`/admin/materials?q=${P}%20Hacked`)).includes(`${P} Hacked`), `${r.status} ${loc(r)}`);
  const html = await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text();
  const before2 = files().length;
  await submit(`/admin/materials?chapter=${A.ch1}`, s1.jar, (f) => hidden("id", pdfId)(f) && !f.includes('name="status"') && !f.includes('name="direction"'), {}, { rawHtml: html });
  check("student replaying the delete-material action deletes nothing", (await dl(pdfId, admin)).r.status === 200 && files().length === before2); }

// ---- edit / replace / move / type lock / delete --------------------------------------------------------------
{ const r = await submit(`/admin/materials/${pdfId}`, admin, hasField("title"), { title: `${P} Chapter 1 Notes v2`, description: "Edited", chapterId: A.ch1, status: "PUBLISHED", file: file(new Uint8Array(0), "") });
  check("edit: change title without touching the file", loc(r).endsWith("notice=material-updated"), `${r.status} ${loc(r)}`);
  check("edit: file untouched when no new file is chosen", files().includes(pdfKey) && same((await dl(pdfId, admin)).body, PDF_BYTES)); }
{ const r = await submit(`/admin/materials/${pdfId}`, admin, hasField("title"), { title: `${P} Chapter 1 Notes v2`, description: "Edited", chapterId: A.ch1, status: "PUBLISHED", file: file(PDF2_BYTES, "Replacement.pdf", "application/pdf") });
  check("edit: replace the file", loc(r).endsWith("notice=material-updated"), `${r.status} ${loc(r)}`);
  const x = await dl(pdfId, admin);
  check("edit: new bytes are served and the old stored file is deleted", same(x.body, PDF2_BYTES) && !files().includes(pdfKey), `old still present: ${files().includes(pdfKey)}`);
  check("edit: display name follows the new file", (x.r.headers.get("content-disposition") ?? "").includes("Replacement.pdf")); }
{ const r = await submit(`/admin/materials/${pdfId}`, admin, hasField("title"), { title: `${P} Chapter 1 Notes v2`, chapterId: A.ch1, status: "PUBLISHED", file: file(enc("MZ\x90\x00 evil"), "evil.pdf") });
  check("edit: a bad replacement file is rejected and the current file is kept", r.status === 200 && text(await r.text()).includes("don't match") && same((await dl(pdfId, admin)).body, PDF2_BYTES)); }
{ const r = await submit(`/admin/materials/${pdfId}`, admin, hasField("title"), { type: "LINK", externalUrl: "https://example.com", title: `${P} Retyped`, chapterId: A.ch1, status: "PUBLISHED" });
  check("edit: the type of a material can't be changed", r.status === 200 && text(await r.text()).includes("can't be changed") && (await dl(pdfId, admin)).r.status === 200); }
{ const r = await submit(`/admin/materials/${linkId}`, admin, hasField("title"), { title: `${P} Practice Site`, externalUrl: "https://www.khanacademy.org/science", chapterId: A.ch2, status: "PUBLISHED" });
  check("edit: move a material to another chapter", loc(r).includes(`chapter=${A.ch2}`), `${r.status} ${loc(r)}`);
  check("...it now appears in the new chapter only", (await pageText(`/admin/materials?chapter=${A.ch2}`)).includes(`${P} Practice Site`) && !(await pageText(`/admin/materials?chapter=${A.ch1}`)).includes(`${P} Practice Site`));
  check("...and its link was updated", /khanacademy\.org\/science/.test(await (await get(`/admin/materials/${linkId}`, admin)).text())); }
{ const r = await submit(`/admin/materials/${ytId}`, admin, hasField("title"), { title: `${P} Intro Video`, youtubeUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0", duration: "", chapterId: A.ch1, status: "PUBLISHED" });
  const edit = await (await get(`/admin/materials/${ytId}`, admin)).text();
  check("edit: change a YouTube link and clear the duration", loc(r).endsWith("notice=material-updated") && edit.includes("9bZkp7q19f0") && !edit.includes("dQw4w9WgXcQ")); }
{ const r = await get("/admin/materials/not-an-id", admin); check("edit: bad id -> 404", r.status === 404, String(r.status)); }

// chapter delete guard, then delete a file material and check the file leaves the disk
{ const html = await (await get(`/admin/chapters?subject=${A.sid}`, admin)).text();
  const r = await submit(`/admin/chapters?subject=${A.sid}`, admin, (f) => hidden("id", A.ch1)(f) && !f.includes('name="status"') && !f.includes('name="direction"'), {}, { rawHtml: html });
  check("chapter with materials can't be deleted", loc(r).includes("error=chapter-not-empty"), loc(r)); }
{ const key = files().find((f) => !before.includes(f) && f !== pdfKey && f.endsWith(".pdf"));
  const html = await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text();
  const r = await submit(`/admin/materials?chapter=${A.ch1}`, admin, (f) => hidden("id", pdfId)(f) && !f.includes('name="status"') && !f.includes('name="direction"'), {}, { rawHtml: html });
  check("delete: file material removed", loc(r).includes("notice=material-deleted"), loc(r));
  check("delete: its stored file is removed from disk", !!key && !files().includes(key), `key ${key}`);
  check("delete: it can no longer be downloaded", (await dl(pdfId, admin)).r.status === 404);
  check("delete: it no longer appears in the list", !(await pageText(`/admin/materials?chapter=${A.ch1}`)).includes("Chapter 1 Notes v2")); }
{ const html = await (await get(`/admin/materials?chapter=${A.ch1}`, admin)).text();
  await submit(`/admin/materials?chapter=${A.ch1}`, admin, (f) => hidden("id", docxId)(f) && !f.includes('name="status"') && !f.includes('name="direction"'), {}, { rawHtml: html });
  check("delete: DOCX file also cleaned up (no stored files left from this run)", files().filter((f) => !before.includes(f)).length === 0, files().filter((f) => !before.includes(f)).join()); }

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
