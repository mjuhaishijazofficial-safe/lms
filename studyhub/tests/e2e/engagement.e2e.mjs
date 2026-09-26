// Phase 5 end-to-end test: bookmarks, marking material complete, and search.
// Run with the app up and .env loaded, from the project root:  node --env-file=.env tests/e2e/engagement.e2e.mjs
import { PrismaClient } from "@prisma/client";

const B = process.argv[2] ?? "http://localhost:3200";
const P = "SmokeTest";
const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD;
if (!ADMIN_PW) { console.error("Run with the .env loaded:  node --env-file=.env <this file>"); process.exit(1); }
const db = new PrismaClient();
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && extra ? "   -> " + extra : ""}`); if (!ok) fails++; };
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html) => dec(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
const CUID = "c[a-z0-9]{20,}";

class Jar {
  c = new Map();
  store(res) { for (const h of res.headers.getSetCookie()) { const [kv] = h.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (v === "" || /max-age=0|expires=thu, 01 jan 1970/i.test(h)) this.c.delete(k); else this.c.set(k, v); } }
  get header() { return [...this.c].map(([k, v]) => `${k}=${v}`).join("; "); }
}
const get = async (path, jar) => { const r = await fetch(B + path, { redirect: "manual", headers: { cookie: jar?.header ?? "" } }); jar?.store(r); return r; };
const loc = (r) => (r.headers.get("location") ?? "").replace(B, "");
// `t` is scoped to <main> only: the sidebar, top search box and notifications bell (which lists ANY recently
// added, visible material regardless of bookmark status) all render outside it and would otherwise cause false
// matches, e.g. an un-bookmarked material still shows up in "recently added" and must not be mistaken for a hit.
function mainOnly(html) {
  const start = html.indexOf("<main");
  const openEnd = html.indexOf(">", start);
  const end = html.lastIndexOf("</main>");
  return start >= 0 && end > start ? html.slice(openEnd + 1, end) : html;
}
const page = async (path, jar) => { const r = await get(path, jar); const h = await r.text(); return { r, h, t: text(mainOnly(h)) }; };

async function submit(path, jar, pick, fields = {}, { rawHtml } = {}) {
  const doc = rawHtml ?? await (await get(path, jar)).text();
  const forms = [...doc.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map((m) => m[1]);
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
const login = (jar, email, password) => submit("/login", jar, hasField("email"), { email, password });
const bookmarkFormPick = (f) => hasField("materialId")(f) && f.includes("Bookmark");
const completeFormPick = (f) => hasField("materialId")(f) && !f.includes("Bookmark");
const subjectBookmarkPick = (f) => hasField("subjectId")(f);

const admin = new Jar();
await login(admin, "admin@studyhub.local", ADMIN_PW);
const idOf = async (path, re) => (await (await get(path, admin)).text()).match(re)?.[1];

// ---- scaffolding: one program, one semester, two subjects (current + a later, invisible one), chapters+materials --
async function makeCourse(name) {
  await submit("/admin/courses/new", admin, hasField("name"), { name, description: "", status: "PUBLISHED" });
  return idOf("/admin/courses", new RegExp(`href="/admin/courses/(${CUID})"[^>]*>${name}<`));
}
const courseA = await makeCourse(`${P} Uni A`);
const courseB = await makeCourse(`${P} Uni B`); // a different program, for isolation checks
await submit(`/admin/courses/${courseA}`, admin, hasField("count"), { count: "2" });
await submit(`/admin/courses/${courseB}`, admin, hasField("count"), { count: "1" });
const semRows = async (courseId) => [...(await (await get(`/admin/courses/${courseId}`, admin)).text()).matchAll(/<input[^>]*>/g)]
  .map((m) => m[0]).filter((t) => /id="sem-c/.test(t))
  .map((t) => [/id="sem-([a-z0-9]+)"/.exec(t)[1], dec(/value="([^"]*)"/.exec(t)?.[1] ?? "")]);
const semA = Object.fromEntries((await semRows(courseA)).map(([id, name]) => [name, id]));
const semB = Object.fromEntries((await semRows(courseB)).map(([id, name]) => [name, id]));
check("scaffolding: two programs, each with semesters", !!semA["Semester 1"] && !!semA["Semester 2"] && !!semB["Semester 1"]);

async function makeSubject(courseId, semesterId, name) {
  await submit("/admin/subjects/new", admin, hasField("name"), { courseId, semesterId: semesterId ?? "", name, description: `About ${name}`, icon: "code", status: "PUBLISHED" });
  return idOf(`/admin/subjects?course=${courseId}`, new RegExp(`href="/admin/subjects/(${CUID})"[^>]*>${name}<`));
}
const visibleSubject = await makeSubject(courseA, semA["Semester 1"], `${P} Visible Subject`);
const laterSubject = await makeSubject(courseA, semA["Semester 2"], `${P} Later Subject`); // out of reach for a Semester 1 student
const otherProgramSubject = await makeSubject(courseB, semB["Semester 1"], `${P} Other Program Subject`);
check("subjects created (visible / later semester / other program)", !!visibleSubject && !!laterSubject && !!otherProgramSubject);

async function makeChapter(subjectId, number, title) {
  await submit("/admin/chapters/new", admin, hasField("title"), { subjectId, chapterNumber: String(number), title, description: "", status: "PUBLISHED" });
  return idOf(`/admin/chapters?subject=${subjectId}`, new RegExp(`href="/admin/chapters/(${CUID})"[^>]*>${title}<`));
}
const ch1 = await makeChapter(visibleSubject, 1, `${P} Chapter One`);
const chLater = await makeChapter(laterSubject, 1, `${P} Later Chapter`);
const chOther = await makeChapter(otherProgramSubject, 1, `${P} Other Chapter`);

async function makeMaterial(chapterId, title, extra = {}) {
  await submit("/admin/materials/new", admin, hasField("title"), { type: "TEXT", chapterId, title, description: "", status: "PUBLISHED", textContent: `<p>${title}</p>`, ...extra });
  return idOf(`/admin/materials?chapter=${chapterId}`, new RegExp(`href="/admin/materials/(${CUID})"[^>]*>${title}<`));
}
const mat1 = await makeMaterial(ch1, `${P} Alpha Note`);
const mat2 = await makeMaterial(ch1, `${P} Beta Note`);
const matLater = await makeMaterial(chLater, `${P} Later Note`);
const matOther = await makeMaterial(chOther, `${P} Other Note`);
check("materials created (2 in the visible chapter, 1 later, 1 other program)", [mat1, mat2, matLater, matOther].every(Boolean));

async function makeStudent(name, email, courseId, semesterId) {
  await submit("/admin/students/new", admin, hasField("email"), { name: `${P} ${name}`, email, studentId: "", courseId, semesterId: semesterId ?? "", status: "ACTIVE", password: "Temp-pass-001" });
  const jar = new Jar(); await login(jar, email, "Temp-pass-001");
  await submit("/change-password", jar, hasField("current"), { current: "Temp-pass-001", password: "Student-pass-123", confirm: "Student-pass-123" });
  return { jar, email };
}
const alice = await makeStudent("Alice", "smoketest.eng.alice", courseA, semA["Semester 1"]);
const bob = await makeStudent("Bob", "smoketest.eng.bob", courseA, semA["Semester 1"]);

// ================================================================================================================
// SEARCH
// ================================================================================================================
{ const { r, t } = await page("/search", alice.jar); check("search: bare page loads with no results and no error", r.status === 200 && !t.includes("No results found") && t.includes("Search")); }
{ const { t } = await page("/search?q=zzz-nothing-matches", alice.jar); check("search: a query matching nothing says so", t.includes("No results found")); }
{ const { t, h } = await page(`/search?q=${encodeURIComponent(P + " Visible Subject")}`, alice.jar);
  check("search: finds a visible subject by name", t.includes(`${P} Visible Subject`) && h.includes(`href="/subjects/${visibleSubject}"`)); }
{ const { t } = await page(`/search?q=${encodeURIComponent(P + " visible subject")}`, alice.jar); check("search: is case-insensitive", t.includes(`${P} Visible Subject`)); }
{ const { t, h } = await page(`/search?q=${encodeURIComponent(P + " Chapter One")}`, alice.jar);
  check("search: finds a chapter by title, linking into the subject at that chapter", t.includes(`${P} Chapter One`) && h.includes(`chapter=${ch1}`)); }
{ const { t, h } = await page(`/search?q=${encodeURIComponent(P + " Alpha Note")}`, alice.jar);
  check("search: finds a material by title", t.includes(`${P} Alpha Note`) && h.includes(`href="/materials/${mat1}"`)); }
{ const { t } = await page(`/search?q=${encodeURIComponent(P)}`, alice.jar);
  check("search: a later semester's subject/chapter/material never appears", !t.includes("Later Subject") && !t.includes("Later Chapter") && !t.includes("Later Note"));
  check("search: another program's content never appears", !t.includes("Other Program Subject") && !t.includes("Other Chapter") && !t.includes("Other Note"));
  check("search: same-scope content does appear alongside", t.includes("Visible Subject") && t.includes("Chapter One") && t.includes("Alpha Note")); }
{ const r = await get("/search?q=x", null); check("search: signed-out -> redirect to /login", r.status === 307 && loc(r) === "/login", `${r.status} ${loc(r)}`); }
{ const r = await get(`/search?q=${encodeURIComponent(P)}`, admin); check("search: admin is sent to /admin, never sees the student search page", r.status === 307 && loc(r) === "/admin"); }

// ================================================================================================================
// SUBJECT BOOKMARKS
// ================================================================================================================
{ const { h } = await page(`/subjects/${visibleSubject}`, alice.jar); check("subject page: starts un-bookmarked", h.includes(">Add to Bookmarks<") && !h.includes(">Bookmarked<")); }
{ const r = await submit(`/subjects/${visibleSubject}`, alice.jar, subjectBookmarkPick, { subjectId: visibleSubject });
  check("bookmark a subject: redirects back to the subject page", loc(r) === `/subjects/${visibleSubject}`, `${r.status} ${loc(r)}`); }
{ const { h } = await page(`/subjects/${visibleSubject}`, alice.jar); check("subject page now shows Bookmarked", h.includes(">Bookmarked<")); }
{ const { t, h } = await page("/bookmarks", alice.jar); check("bookmarks page: lists the bookmarked subject", t.includes(`${P} Visible Subject`) && h.includes(`href="/subjects/${visibleSubject}"`)); }
{ const { t } = await page("/bookmarks", bob.jar); check("isolation: another student's bookmarks are empty", t.includes("No bookmarks yet")); }
{ const r = await submit(`/subjects/${visibleSubject}`, alice.jar, subjectBookmarkPick, { subjectId: visibleSubject });
  check("un-bookmark a subject via the same toggle", loc(r) === `/subjects/${visibleSubject}`);
  const { h } = await page(`/subjects/${visibleSubject}`, alice.jar); check("...subject page reverts to Add to Bookmarks", h.includes(">Add to Bookmarks<") && !h.includes(">Bookmarked<")); }
{ // re-bookmark, then remove it from the Bookmarks page itself
  await submit(`/subjects/${visibleSubject}`, alice.jar, subjectBookmarkPick, { subjectId: visibleSubject });
  const before = await page("/bookmarks", alice.jar);
  const r = await submit("/bookmarks", alice.jar, subjectBookmarkPick, {}, { rawHtml: before.h });
  check("remove bookmark: from the Bookmarks page redirects back there", loc(r) === "/bookmarks", `${r.status} ${loc(r)}`);
  const { t } = await page("/bookmarks", alice.jar); check("...and the subject is gone", !t.includes(`${P} Visible Subject`) || t.includes("No bookmarks yet")); }
{ // tamper: replay the toggle action against a subject outside the student's scope
  const doc = await (await get(`/subjects/${visibleSubject}`, alice.jar)).text();
  const r = await submit(`/subjects/${visibleSubject}`, alice.jar, subjectBookmarkPick, { subjectId: laterSubject }, { rawHtml: doc });
  // The form's own hidden returnTo (the page it was rendered on) wins over the tampered id, so it redirects back to visibleSubject.
  check("tamper: bookmarking a later-semester subject id is refused", loc(r) === `/subjects/${visibleSubject}`, `${r.status} ${loc(r)}`);
  const bm = await db.subjectBookmark.findFirst({ where: { subjectId: laterSubject } });
  check("...and nothing was written to the database", !bm); }
{ const doc2 = await (await get(`/subjects/${visibleSubject}`, alice.jar)).text();
  await submit(`/subjects/${visibleSubject}`, alice.jar, subjectBookmarkPick, { subjectId: otherProgramSubject }, { rawHtml: doc2 });
  const bm = await db.subjectBookmark.findFirst({ where: { subjectId: otherProgramSubject } });
  check("tamper: bookmarking another program's subject id writes nothing", !bm); }
{ const r = await get("/bookmarks", null); check("bookmarks: signed-out -> /login", r.status === 307 && loc(r) === "/login"); }

// ================================================================================================================
// MATERIAL BOOKMARKS
// ================================================================================================================
{ const { h } = await page(`/materials/${mat1}`, alice.jar); check("material page: starts un-bookmarked", h.includes(">Bookmark<") && !h.includes(">Bookmarked<")); }
{ const doc = await (await get(`/materials/${mat1}`, alice.jar)).text();
  const r = await submit(`/materials/${mat1}`, alice.jar, bookmarkFormPick, { materialId: mat1 }, { rawHtml: doc });
  check("bookmark a material: redirects back to it", loc(r) === `/materials/${mat1}`, `${r.status} ${loc(r)}`); }
{ const { h } = await page(`/materials/${mat1}`, alice.jar); check("material page now shows Bookmarked", h.includes(">Bookmarked<")); }
{ const { t, h } = await page("/bookmarks", alice.jar); check("bookmarks page: lists the bookmarked material with its subject/chapter context", t.includes(`${P} Alpha Note`) && t.includes(`${P} Visible Subject`) && h.includes(`href="/materials/${mat1}"`)); }
{ // bookmark a second material, confirm both appear, newest first
  const doc = await (await get(`/materials/${mat2}`, alice.jar)).text();
  await submit(`/materials/${mat2}`, alice.jar, bookmarkFormPick, { materialId: mat2 }, { rawHtml: doc });
  const { t } = await page("/bookmarks", alice.jar);
  check("bookmarks page: newest bookmark listed first", t.indexOf("Beta Note") < t.indexOf("Alpha Note"), t.slice(t.indexOf("Materials"), t.indexOf("Materials") + 200)); }
{ const { t } = await page("/bookmarks", bob.jar); check("isolation: Bob's bookmarks are still empty (Alice's don't leak)", t.includes("No bookmarks yet")); }
{ // remove one via the Bookmarks page
  const before = await page("/bookmarks", alice.jar);
  const r = await submit("/bookmarks", alice.jar, (f) => hasField("materialId")(f) && f.includes(">Remove<"), { materialId: mat2 }, { rawHtml: before.h });
  check("remove a bookmarked material from the Bookmarks page", loc(r) === "/bookmarks", `${r.status} ${loc(r)}`);
  const { t } = await page("/bookmarks", alice.jar);
  check("...it's gone, the other one remains", !t.includes("Beta Note") && t.includes("Alpha Note"), t.slice(t.indexOf("Materials"), t.indexOf("Materials") + 300)); }
{ // tamper: bookmark a material outside scope by replaying the action with a foreign id
  const doc = await (await get(`/materials/${mat1}`, alice.jar)).text();
  await submit(`/materials/${mat1}`, alice.jar, bookmarkFormPick, { materialId: matOther }, { rawHtml: doc });
  const bm = await db.materialBookmark.findFirst({ where: { materialId: matOther } });
  check("tamper: bookmarking another program's material writes nothing", !bm); }
{ const doc = await (await get(`/materials/${mat1}`, alice.jar)).text();
  await submit(`/materials/${mat1}`, alice.jar, bookmarkFormPick, { materialId: matLater }, { rawHtml: doc });
  const bm = await db.materialBookmark.findFirst({ where: { materialId: matLater } });
  check("tamper: bookmarking a later-semester material writes nothing", !bm); }

// ================================================================================================================
// PROGRESS: opened + mark as complete
// ================================================================================================================
{ await get(`/materials/${mat1}`, alice.jar); // a real visit
  const row = await db.materialProgress.findFirst({ where: { materialId: mat1, user: { email: alice.email } } });
  check("visiting a material page records it as opened", !!row && !row.completedAt); }
{ const { h } = await page(`/materials/${mat1}`, alice.jar); check("material page: not completed yet, shows the call to action", h.includes(">Mark as complete<") && !h.includes(">Completed<")); }
{ const doc = await (await get(`/materials/${mat1}`, alice.jar)).text();
  const r = await submit(`/materials/${mat1}`, alice.jar, completeFormPick, { materialId: mat1 }, { rawHtml: doc });
  check("mark a material complete: redirects back to it", loc(r) === `/materials/${mat1}`, `${r.status} ${loc(r)}`); }
{ const { h } = await page(`/materials/${mat1}`, alice.jar); check("material page now shows Completed", h.includes(">Completed<") && !h.includes(">Mark as complete<")); }
{ const { h } = await page(`/subjects/${visibleSubject}`, alice.jar); check("subject page: the completed material shows its checkmark", new RegExp(`aria-label="Completed"`).test(h)); }
{ const { t } = await page(`/subjects/${visibleSubject}`, alice.jar); check("subject page: chapter not fully done yet (only 1 of 2 materials)", !/aria-label="Chapter completed"/.test((await page(`/subjects/${visibleSubject}`, alice.jar)).h) && t.includes(`${P} Chapter One`)); }
{ // complete the second material too -> the whole chapter is done
  const doc = await (await get(`/materials/${mat2}`, alice.jar)).text();
  await submit(`/materials/${mat2}`, alice.jar, completeFormPick, { materialId: mat2 }, { rawHtml: doc });
  const { h, t } = await page(`/subjects/${visibleSubject}`, alice.jar);
  check("subject page: chapter shows completed once every material in it is done", /aria-label="Chapter completed"/.test(h));
  check("subject page: overall progress is 100% (1 of 1 counted chapters)", /1 \/ 1 chapters/.test(t) && /100\s*%/.test(t), t.match(/\d+ \/ \d+ chapters/)?.[0]); }
{ const t = text((await page("/dashboard", alice.jar)).h); check("dashboard: reflects the same 100% progress", /\b100\s*%\s+Your progress\b/.test(t), t.match(/\S+%\s+Your progress\b/)?.[0]); }
{ const t = text((await page("/courses", alice.jar)).h); check("my courses: the class card also reflects 100%", /100\s*%/.test(t)); }
{ const t = text((await page("/dashboard", bob.jar)).h); check("isolation: Bob's own progress is untouched (still 0%)", /\b0\s*%\s+Your progress\b/.test(t), t.match(/\S+%\s+Your progress\b/)?.[0]); }
{ // undo completion on one material -> chapter is no longer "done", percentage drops
  const doc = await (await get(`/materials/${mat1}`, alice.jar)).text();
  await submit(`/materials/${mat1}`, alice.jar, completeFormPick, { materialId: mat1 }, { rawHtml: doc });
  const { h, t } = await page(`/subjects/${visibleSubject}`, alice.jar);
  check("un-completing a material un-completes the chapter", !/aria-label="Chapter completed"/.test(h) && /0 \/ 1 chapters/.test(t), t.match(/\d+ \/ \d+ chapters/)?.[0]); }
{ // tamper: try to mark a later-semester / other-program material complete
  const doc = await (await get(`/materials/${mat1}`, alice.jar)).text();
  await submit(`/materials/${mat1}`, alice.jar, completeFormPick, { materialId: matLater }, { rawHtml: doc });
  const row = await db.materialProgress.findFirst({ where: { materialId: matLater } });
  check("tamper: completing a later-semester material writes nothing", !row); }
{ const doc = await (await get(`/materials/${mat1}`, alice.jar)).text();
  await submit(`/materials/${mat1}`, alice.jar, completeFormPick, { materialId: matOther }, { rawHtml: doc });
  const row = await db.materialProgress.findFirst({ where: { materialId: matOther } });
  check("tamper: completing another program's material writes nothing", !row); }
{ const r = await get(`/materials/${mat1}`, null); check("visiting a material page signed-out doesn't record anything and redirects to login", r.status === 307 && loc(r) === "/login");
  const count = await db.materialProgress.count({ where: { materialId: mat1 } });
  check("...(only Alice's earlier, legitimate row exists)", count === 1, String(count)); }

await db.$disconnect();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
