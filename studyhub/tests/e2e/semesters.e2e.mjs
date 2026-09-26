// Semester end-to-end test: setting up a degree program, and what students at different semesters can see.
// Run with the app up, from the project root:  node tests/e2e/semesters.e2e.mjs
// (uses Prisma directly for one thing the UI can no longer create: a course with no semester, to check that
//  courses left over from before that rule still behave correctly and can still be placed into one)
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const B = process.argv[2] ?? "http://localhost:3200";
const P = "SmokeTest";
const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD;
if (!ADMIN_PW) { console.error("Run with the .env loaded:  node --env-file=.env <this file>"); process.exit(1); }
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && extra ? "   -> " + extra : ""}`); if (!ok) fails++; };
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html) => dec(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

class Jar {
  c = new Map();
  store(res) { for (const h of res.headers.getSetCookie()) { const [kv] = h.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (v === "" || /max-age=0|expires=thu, 01 jan 1970/i.test(h)) this.c.delete(k); else this.c.set(k, v); } }
  get header() { return [...this.c].map(([k, v]) => `${k}=${v}`).join("; "); }
}
const get = async (path, jar) => { const r = await fetch(B + path, { redirect: "manual", headers: { cookie: jar?.header ?? "" } }); jar?.store(r); return r; };
const loc = (r) => (r.headers.get("location") ?? "").replace(B, "");
const page = async (path, jar) => { const r = await get(path, jar); return { r, h: await r.text() }; };

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
const hidden = (name, value) => (f) => new RegExp(`name="${name}"[^>]*value="${value}"`).test(f) || new RegExp(`value="${value}"[^>]*name="${name}"`).test(f);
const login = (jar, email, password) => submit("/login", jar, hasField("email"), { email, password });
const CUID = "c[a-z0-9]{20,}";

/** Submits the confirm-dialog form whose heading contains `title` (delete and promote dialogs share the same fields). */
async function submitDialog(path, jar, title) {
  const doc = await (await get(path, jar)).text();
  const block = doc.split("<dialog").slice(1).find((b) => dec(b).includes(title));
  if (!block) throw new Error(`dialog "${title}" not found on ${path}`);
  return submit(path, jar, () => true, {}, { rawHtml: block });
}

const admin = new Jar();
await login(admin, "admin@studyhub.local", ADMIN_PW);
const idOf = async (path, re) => (await (await get(path, admin)).text()).match(re)?.[1];
const enc = (s) => new TextEncoder().encode(s);
const pdf = () => new File([enc("%PDF-1.4\n% semester e2e\n%%EOF\n")], "Slides.pdf", { type: "application/pdf" });

// ---- 1. set up a degree program with semesters ---------------------------------------------------------------
await submit("/admin/courses/new", admin, hasField("name"), { name: `${P} Uni`, description: "Four-year degree", status: "PUBLISHED" });
const uni = await idOf("/admin/courses", new RegExp(`href="/admin/courses/(${CUID})"[^>]*>${P} Uni<`));
await submit("/admin/courses/new", admin, hasField("name"), { name: `${P} Other`, description: "", status: "PUBLISHED" });
const other = await idOf("/admin/courses", new RegExp(`href="/admin/courses/(${CUID})"[^>]*>${P} Other<`));
check("two programs created", !!uni && !!other);

const semPage = `/admin/courses/${uni}`;
/** Every semester name input on the program page as [id, name], whatever order React writes the attributes in. */
const semRows = async () => [...(await (await get(semPage, admin)).text()).matchAll(/<input[^>]*>/g)]
  .map((m) => m[0]).filter((t) => /id="sem-c/.test(t))
  .map((t) => [/id="sem-([a-z0-9]+)"/.exec(t)[1], dec(/value="([^"]*)"/.exec(t)?.[1] ?? "")]);
const semNames = async () => (await semRows()).map(([, name]) => name);
{ const t = text((await get(semPage, admin).then((r) => r.text()))); check("program page: empty semester list explains itself", t.includes("No semesters yet") && /Add VU courses/.test(t) && /Add Semester 1/.test(t) && !/Add 8/.test(t)); }
{ const r = await submit(semPage, admin, hasField("count"), { count: "13" }); check("generate: more than 12 at once is refused", loc(r).includes("error=failed"), loc(r)); }
{ const r = await submit(semPage, admin, hasField("count"), { count: "4" });
  check("generate: adds Semester 1-4 in one step", loc(r).includes("notice=semesters-generated"), loc(r));
  const first = await semNames();
  const second = await semNames();
  check("...named and ordered", first.join() === "Semester 1,Semester 2,Semester 3,Semester 4", `first read=${JSON.stringify(first)} second read=${JSON.stringify(second)}`); }
// The "add a semester" form, not a semester's own "add a course" box (which also has courseId + name, plus semesterId).
const addSemesterForm = (f) => f.includes('name="courseId"') && hasField("name")(f) && !f.includes('name="semesterId"');
{ const r = await submit(semPage, admin, addSemesterForm, { name: "Summer Term" });
  check("add one: appended at the end", loc(r).includes("notice=semester-created") && (await semNames()).at(-1) === "Summer Term", loc(r)); }
{ const r = await submit(semPage, admin, addSemesterForm, { name: "  " }); check("add one: blank name refused", loc(r).includes("error=failed")); }

const semIds = async () => Object.fromEntries((await semRows()).map(([id, name]) => [name, id]));
let S = await semIds();
{ const r = await submit(semPage, admin, (f) => hidden("id", S["Summer Term"])(f) && hasField("name")(f), { name: "Semester 5" });
  check("rename a semester", loc(r).includes("notice=semester-renamed") && (await semNames()).includes("Semester 5"), loc(r)); }
S = await semIds();
{ const html = await (await get(semPage, admin)).text();
  await submit(semPage, admin, (f) => hidden("id", S["Semester 5"])(f) && hidden("direction", "up")(f), {}, { rawHtml: html });
  check("reorder: move Semester 5 up", (await semNames()).join() === "Semester 1,Semester 2,Semester 3,Semester 5,Semester 4", (await semNames()).join());
  const html2 = await (await get(semPage, admin)).text();
  await submit(semPage, admin, (f) => hidden("id", S["Semester 5"])(f) && hidden("direction", "down")(f), {}, { rawHtml: html2 });
  check("...and back down", (await semNames()).join() === "Semester 1,Semester 2,Semester 3,Semester 4,Semester 5"); }
{ const r = await submitDialog(semPage, admin, "Delete “Semester 5”");
  check("delete an unused semester", loc(r).includes("notice=semester-deleted") && !(await semNames()).includes("Semester 5"), loc(r)); }
S = await semIds();
const sem = (n) => S[`Semester ${n}`];
check("four semesters remain", [1, 2, 3, 4].every((n) => !!sem(n)));

// another program's semester, for tampering tests
await submit(`/admin/courses/${other}`, admin, hasField("count"), { count: "2" });
const otherSem1 = (await (await get(`/admin/courses/${other}`, admin)).text()).match(new RegExp(`id="sem-(${CUID})"`))?.[1];

// ---- 2. subjects in semesters ---------------------------------------------------------------------------------
async function makeSubject(name, semesterId, courseId = uni) {
  const r = await submit("/admin/subjects/new", admin, hasField("name"), { courseId, semesterId: semesterId ?? "", name: `${P} ${name}`, description: `About ${name}`, icon: "code", status: "PUBLISHED" });
  const id = await idOf(`/admin/subjects?course=${courseId}`, new RegExp(`href="/admin/subjects/(${CUID})"[^>]*>${P} ${name}<`));
  return { r, id };
}
const subj = {};
for (const [name, n] of [["Programming", 1], ["Algorithms", 2], ["Databases", 3], ["Networks", 4]]) subj[name] = (await makeSubject(name, sem(n))).id;
{ const { r } = await makeSubject("No Semester", null);
  check("a course now needs a semester: the form refuses one left blank", r.status === 200 && text(await r.text()).includes("Choose a semester"), `${r.status}`); }
// "Writing" applies to the whole program (no semester) — created directly, since the form no longer allows that; it
// represents a course made before this rule, which visibility.ts and the program page still need to handle.
subj.Writing = (await db.subject.create({ data: { courseId: uni, name: `${P} Writing`, description: "About Writing", icon: "code", status: "PUBLISHED", order: 999 } })).id;
check("subjects created in semesters 1-4 and one for the whole program", Object.values(subj).every(Boolean));
{ const { r } = await makeSubject("Tamper", otherSem1);
  check("a semester from another program is refused for a subject", r.status === 200 && text(await r.text()).includes("belongs to this program"), `${r.status}`);
  check("...and nothing was created", !(await idOf(`/admin/subjects?course=${uni}`, new RegExp(`href="/admin/subjects/(${CUID})"[^>]*>${P} Tamper<`)))); }
{ const t = text(await (await get(`/admin/subjects?semester=${sem(3)}`, admin)).text());
  check("admin subject filter by semester", t.includes(`${P} Databases`) && !t.includes(`${P} Networks`) && !t.includes(`${P} Programming`)); }
{ const t = text(await (await get(`/admin/subjects?course=${uni}`, admin)).text());
  check("admin subject list shows each subject's semester (and flags one with none)", /Databases[\s\S]{0,120}Semester 3/.test(t) && /Writing[\s\S]{0,120}No semester yet/.test(t)); }

const chapter = {};
for (const [name, id] of Object.entries(subj)) {
  await submit("/admin/chapters/new", admin, hasField("title"), { subjectId: id, chapterNumber: "1", title: `${P} ${name} Ch1`, description: "", status: "PUBLISHED" });
  chapter[name] = await idOf(`/admin/chapters?subject=${id}`, new RegExp(`href="/admin/chapters/(${CUID})"[^>]*>${P} ${name} Ch1<`));
}
const material = {};
for (const name of Object.keys(subj)) {
  await submit("/admin/materials/new", admin, hasField("title"), { type: "FILE", chapterId: chapter[name], title: `${P} ${name} Slides`, description: "", status: "PUBLISHED", file: pdf() });
  material[name] = await idOf(`/admin/materials?chapter=${chapter[name]}`, new RegExp(`href="/admin/materials/(${CUID})"[^>]*>${P} ${name} Slides<`));
}
check("a chapter and a file material in every subject", Object.values(chapter).every(Boolean) && Object.values(material).every(Boolean));

// ---- 3. students at different semesters ------------------------------------------------------------------------
async function makeStudent(name, email, fields) {
  const r = await submit("/admin/students/new", admin, hasField("email"), { name: `${P} ${name}`, email, studentId: "", status: "ACTIVE", password: "Temp-pass-001", ...fields });
  if (!loc(r).includes("notice=student-created")) return { jar: null, id: undefined, email, r }; // refused (an expected outcome in some tests)
  const jar = new Jar(); await login(jar, email, "Temp-pass-001");
  await submit("/change-password", jar, hasField("current"), { current: "Temp-pass-001", password: "Student-pass-123", confirm: "Student-pass-123" });
  const id = (await (await get(`/admin/students?q=${email}`, admin)).text()).match(new RegExp(`href="/admin/students/(${CUID})"`))?.[1];
  return { jar, id, email, r };
}
const A = await makeStudent("Ana", "smoketest.sem.ana", { courseId: uni, semesterId: sem(3) });
const Bb = await makeStudent("Ben", "smoketest.sem.ben", { courseId: uni, semesterId: sem(1) });
const C = await makeStudent("Cal", "smoketest.sem.cal", { courseId: uni, semesterId: sem(4) });
const D = await makeStudent("Dee", "smoketest.sem.dee", { courseId: uni, semesterId: "" });
const X = await makeStudent("Xan", "smoketest.sem.xan", { courseId: other, semesterId: "" });
check("students created", [A, Bb, C, D, X].every((s) => s.id));
{ const r = await makeStudent("Bad", "smoketest.sem.bad", { courseId: uni, semesterId: otherSem1 });
  check("a student can't be put in another program's semester", r.r.status === 200 && text(await r.r.text()).includes("belongs to this program") && !r.id, `${r.r.status}`); }
{ const t = text(await (await get(`/admin/students/${D.id}`, admin)).text());
  const list = text(await (await get(`/admin/students?q=${D.email}`, admin)).text());
  check("no semester chosen -> the student starts in the program's first semester", /Semester 1/.test(list), list.slice(list.indexOf("Dee") - 40, list.indexOf("Dee") + 200)); void t; }
{ const t = text(await (await get(`/admin/students?semester=${sem(3)}`, admin)).text());
  check("admin student filter by semester", t.includes(`${P} Ana`) && !t.includes(`${P} Ben`) && !t.includes(`${P} Cal`)); }

const subjectsOn = async (jar, path = "/subjects") => { const t = text((await page(path, jar)).h); return Object.keys(subj).filter((n) => t.includes(`${P} ${n}`)); };
const dl = async (id, jar) => fetch(`${B}/api/materials/${id}/file`, { headers: { cookie: jar.header }, redirect: "manual" });
const view = async (id, jar) => (await get(`/materials/${id}`, jar)).status;

// ---- 4. visibility by semester ---------------------------------------------------------------------------------
check("semester 3 student sees semesters 1-3 and the whole-program subject, but NOT semester 4", (await subjectsOn(A.jar)).sort().join() === ["Algorithms", "Databases", "Programming", "Writing"].join(), (await subjectsOn(A.jar)).join());
check("semester 1 student sees only semester 1 and whole-program subjects", (await subjectsOn(Bb.jar)).sort().join() === ["Programming", "Writing"].join(), (await subjectsOn(Bb.jar)).join());
check("semester 4 student sees everything", (await subjectsOn(C.jar)).length === 5);
check("a student with no semester chosen started in semester 1", (await subjectsOn(D.jar)).sort().join() === ["Programming", "Writing"].join(), (await subjectsOn(D.jar)).join());
check("a student in another program sees none of these subjects", (await subjectsOn(X.jar)).length === 0);
{ const r = await get(`/subjects/${subj.Networks}`, A.jar); check("later semester: the subject page is a 404 with the permission message", r.status === 404 && (await r.text()).includes("permission to access it"), String(r.status)); }
{ const r = await get(`/subjects/${subj.Databases}`, A.jar); check("current semester: the subject page opens", r.status === 200); }
{ const r = await get(`/subjects/${subj.Programming}`, A.jar); check("earlier semester: the subject page still opens (revision)", r.status === 200); }
check("later semester: material page -> 404", (await view(material.Networks, A.jar)) === 404);
check("earlier semester: material page opens", (await view(material.Programming, A.jar)) === 200);
{ const r = await dl(material.Networks, A.jar); check("later semester: file download -> 403", r.status === 403, String(r.status)); }
{ const r = await dl(material.Databases, A.jar); check("current semester: file download works", r.status === 200 && (await r.arrayBuffer()).byteLength > 10, String(r.status)); }
{ const r = await dl(material.Databases, X.jar); check("another program's student: file download -> 403", r.status === 403, String(r.status)); }
{ const r = await dl(material.Databases, Bb.jar); check("an earlier-semester student can't download a later semester's file", r.status === 403, String(r.status)); }
{ const t = text((await page("/recent", A.jar)).h); check("recent materials follow the same rule", t.includes(`${P} Databases Slides`) && !t.includes(`${P} Networks Slides`)); }
{ const h = (await page("/dashboard", A.jar)).h; const t = text(h);
  check("dashboard: shows the current semester and the program", /Semester 3\s+Semester\b/.test(t) && t.includes(`${P} Uni`), t.slice(0, 220));
  const mine = t.slice(t.indexOf("My subjects"), t.indexOf("Recently added")); // the recent list may legitimately name earlier-semester subjects
  check("dashboard 'My subjects' focuses on the current semester (plus whole-program subjects)", mine.includes(`${P} Databases`) && mine.includes(`${P} Writing`) && !mine.includes(`${P} Programming`) && !mine.includes(`${P} Networks`), mine.slice(0, 300));
  check("dashboard counts all visible subjects and says how many are earlier ones", /\b4\s+Subjects\b/.test(t) && /incl. 2 earlier/.test(t), t.match(/\d+\s+Subjects[^T]{0,40}/)?.[0]); }
{ const t = text((await page("/subjects", A.jar)).h);
  check("subjects page groups by semester: current first, then earlier, then 'All semesters'", t.indexOf("Semester 3") < t.indexOf("Semester 2") && t.indexOf("Semester 2") < t.indexOf("Semester 1") && t.indexOf("Semester 1") < t.indexOf("All semesters") && /Current semester/.test(t)); }
{ const { h } = await page(`/subjects/${subj.Databases}`, A.jar); const t = text(h);
  check("subject page: subtitle and breadcrumb include the semester", t.includes(`${P} Uni · Semester 3`) && h.includes(`href="/courses/${uni}#semester-${sem(3)}"`)); }
{ const t = text((await page(`/courses/${uni}`, A.jar)).h);
  check("program page: semester sections, current one marked", /Semester 3[\s\S]*Current semester/.test(t) && t.includes("Semester 2") && !t.includes("Semester 4")); }
{ const t = text((await page("/profile", A.jar)).h); check("profile shows program and semester", t.includes(`${P} Uni`) && /Semester\s+Semester 3/.test(t)); }

// ---- 5. admin changes take effect at once ----------------------------------------------------------------------
{ await submit(`/admin/students/${A.id}`, admin, hasField("studentId"), { name: `${P} Ana`, email: A.email, studentId: "", courseId: uni, semesterId: sem(2), status: "ACTIVE" });
  const seen = await subjectsOn(A.jar);
  check("moving a student down a semester removes the later subjects at once", seen.sort().join() === ["Algorithms", "Programming", "Writing"].join(), seen.join());
  check("...and the file download follows", (await dl(material.Databases, A.jar)).status === 403);
  await submit(`/admin/students/${A.id}`, admin, hasField("studentId"), { name: `${P} Ana`, email: A.email, studentId: "", courseId: uni, semesterId: sem(3), status: "ACTIVE" });
  check("...and back up restores them", (await subjectsOn(A.jar)).includes("Databases")); }
{ const r = await submit(`/admin/students/${A.id}`, admin, hasField("studentId"), { name: `${P} Ana`, email: A.email, studentId: "", courseId: uni, semesterId: otherSem1, status: "ACTIVE" });
  check("editing a student with a foreign semester is refused and nothing changes", r.status === 200 && (await subjectsOn(A.jar)).includes("Databases")); }
{ const r = await submit(`/admin/subjects/${subj.Databases}`, admin, hasField("name"), { courseId: uni, semesterId: sem(4), name: `${P} Databases`, description: "About Databases", icon: "code", status: "PUBLISHED" });
  check("admin moves a subject to semester 4", loc(r).includes("notice=subject-updated"), `${r.status} ${loc(r)}`);
  check("...it disappears for the semester 3 student", !(await subjectsOn(A.jar)).includes("Databases") && (await view(material.Databases, A.jar)) === 404);
  await submit(`/admin/subjects/${subj.Databases}`, admin, hasField("name"), { courseId: uni, semesterId: sem(3), name: `${P} Databases`, description: "About Databases", icon: "code", status: "PUBLISHED" });
  check("...and returns when moved back", (await subjectsOn(A.jar)).includes("Databases")); }
{ // the edit form can no longer clear a subject's semester (that's what made "Every semester" confusing)
  const r = await submit(`/admin/subjects/${subj.Networks}`, admin, hasField("name"), { courseId: uni, semesterId: "", name: `${P} Networks`, description: "About Networks", icon: "code", status: "PUBLISHED" });
  check("clearing a subject's semester via edit is refused", r.status === 200 && text(await r.text()).includes("Choose a semester") && (await subjectsOn(Bb.jar)).includes("Networks") === false, `${r.status}`); }
{ // a legacy course with no semester (created directly above, as "Writing") is still visible to everyone in the program
  check("a legacy no-semester course is visible from the start", (await subjectsOn(Bb.jar)).includes("Writing"));
  // ...and the admin can place it into a semester from the program page's "needs a semester" panel:
  const html = await (await get(semPage, admin)).text();
  const r = await submit(semPage, admin, (f) => f.includes(`name="semester_${subj.Writing}"`), { [`semester_${subj.Writing}`]: sem(4) }, { rawHtml: html });
  check("placing it from the panel moves it into that semester", loc(r).includes("notice=semesters-assigned") && !(await subjectsOn(Bb.jar)).includes("Writing"), `${r.status} ${loc(r)}`);
  check("...and a semester-4 student now sees it", (await subjectsOn(C.jar)).includes("Writing"));
  await submit(`/admin/subjects/${subj.Writing}`, admin, hasField("name"), { courseId: uni, semesterId: "", name: `${P} Writing`, description: "About Writing", icon: "code", status: "PUBLISHED" });
  check("once placed, the edit form can't blank it out again either", (await subjectsOn(C.jar)).includes("Writing")); }

// ---- 6. promotion ---------------------------------------------------------------------------------------------
const E = await makeStudent("Eve", "smoketest.sem.eve", { courseId: uni, semesterId: sem(3) });
{ const html = await (await get("/admin/students", admin)).text();
  await submit("/admin/students", admin, (f) => hidden("id", E.id)(f) && hidden("status", "INACTIVE")(f), {}, { rawHtml: html }); }
{ const r = await submitDialog(semPage, admin, "Move Semester 3 students up?");
  check("promote: moves active students to the next semester with a count", loc(r).includes("notice=students-promoted") && /n=1\b/.test(loc(r)), loc(r));
  const notice = text((await page(loc(r), admin)).h); check("...and the message says how many moved", /Moved 1 student\(s\) up to the next semester/.test(notice), notice.slice(0, 200));
  check("...the promoted student now sees semester 4 subjects", (await subjectsOn(A.jar)).includes("Networks"));
  check("...and the dashboard shows Semester 4", /Semester 4\s+Semester\b/.test(text((await page("/dashboard", A.jar)).h)));
  const eve = text(await (await get(`/admin/students?q=${E.email}`, admin)).text());
  check("inactive students are not promoted", /Semester 3/.test(eve), eve.slice(eve.indexOf("Eve"), eve.indexOf("Eve") + 160));
  check("students in other semesters are untouched", (await subjectsOn(Bb.jar)).sort().join() === ["Programming"].join()); }
{ // The page hides the button for the last semester, so replay a promote form against Semester 4 directly.
  const block = (await (await get(semPage, admin)).text()).split("<dialog").slice(1).find((b) => dec(b).includes("Move Semester 1 students up?"));
  const r = await submit(semPage, admin, () => true, { id: sem(4) }, { rawHtml: block });
  check("promote: the last semester has nowhere to go, so it is refused", loc(r).includes("error=semester-last"), loc(r));
  check("...and the page says why", text((await page(loc(r), admin)).h).includes("last semester")); }
{ const t = text(await (await get(semPage, admin)).text());
  check("the last semester has no 'Promote students' button (the earlier ones do)", (t.match(/Promote students/g) ?? []).length === 3, String((t.match(/Promote students/g) ?? []).length)); }

// ---- 7. deleting a semester that is in use ---------------------------------------------------------------------
{ const r = await submitDialog(semPage, admin, "Delete “Semester 1”");
  check("a semester with subjects or students can't be deleted", loc(r).includes("error=semester-not-empty"), loc(r));
  const t = text((await page(loc(r), admin)).h); check("...and the message explains why", t.includes("still has subjects or students")); }
{ // Empty a semester completely, then it can go: move its subject and students elsewhere.
  await submit(`/admin/subjects/${subj.Programming}`, admin, hasField("name"), { courseId: uni, semesterId: sem(2), name: `${P} Programming`, description: "About Programming", icon: "code", status: "PUBLISHED" });
  for (const s of [Bb, D]) await submit(`/admin/students/${s.id}`, admin, hasField("studentId"), { name: `${P} x`, email: s.email, studentId: "", courseId: uni, semesterId: sem(2), status: "ACTIVE" });
  const r = await submitDialog(semPage, admin, "Delete “Semester 1”");
  check("once its subjects and students are moved out, the semester can be deleted", loc(r).includes("notice=semester-deleted") && !(await semNames()).includes("Semester 1"), loc(r)); }

// ---- 8. Programs page: courses from VU's scheme of study, and the "add a course" box ------------------------------
{ // Into the SmokeTest "Other" program (so cleanup removes it). The required courses are ticked in the served HTML.
  const vuPage = `/admin/courses/vu?scheme=psychology&program=${other}`;
  const picker = text(await (await get(vuPage, admin)).text());
  check("VU picker lists the degree's courses by semester", picker.includes("PSY101") && picker.includes("Introduction to Psychology") && /Semester 8/.test(picker));
  const r = await submit(vuPage, admin, hasField("slug"), { target: other, status: "PUBLISHED" });
  const n = Number(/[?&]n=(\d+)/.exec(loc(r))?.[1] ?? 0);
  check("VU import: adds the ticked courses and opens the program with a count", loc(r).startsWith(`/admin/courses/${other}?notice=vu-imported`) && n >= 20, loc(r));
  const html = await (await get(`/admin/courses/${other}`, admin)).text();
  const t = text(html);
  check("...each inside its semester, code first", /Semester 1[\s\S]*PSY101 Introduction to Psychology[\s\S]*Semester 2/.test(t) && /Semester 8/.test(t), t.slice(0, 300));
  check("...the page grew to eight semesters", (html.match(/aria-label="More actions for Semester \d"/g) ?? []).length === 8);
  const again = await submit(vuPage, admin, hasField("slug"), { target: other, status: "PUBLISHED" });
  check("VU import twice: nothing is ticked the second time, so nothing is duplicated", again.status === 200 && text(await again.text()).includes("Tick at least one course"), `${again.status} ${loc(again)}`);
  const forged = await submit(vuPage, admin, hasField("slug"), { target: other, status: "PUBLISHED", codes: "PSY101" });
  check("...and a replayed code is skipped, not copied", loc(forged).includes("n=0"), loc(forged)); }
{ const progPage = `/admin/courses/${other}`;
  const quick = (f) => f.includes('name="semesterId"') && hasField("name")(f) && f.includes('name="courseId"');
  const r = await submit(progPage, admin, quick, { name: `${P} Quick Course` });
  check("add-a-course box: adds the course without leaving the page", r.status === 200 && text(await (await get(progPage, admin)).text()).includes(`${P} Quick Course`), `${r.status} ${loc(r)}`);
  const dup = await submit(progPage, admin, quick, { name: `${P.toLowerCase()} quick-course` });
  check("...and refuses a second copy of it", text(await dup.text()).includes("already has a subject called")); }
{ // Empty semesters get a one-click "Remove them", wherever they sit; semesters in use are never touched.
  const progPage = `/admin/courses/${other}`;
  const count = async () => ((await (await get(progPage, admin)).text()).match(/aria-label="More actions for /g) ?? []).length;
  const removeForm = (f) => f.includes('name="courseId"') && !hasField("name")(f) && !f.includes('name="count"') && !f.includes("semester_") && /Remove (it|them)/.test(f);
  const before = await count();
  check("no 'empty' notice while every semester is in use", !text(await (await get(progPage, admin)).text()).includes("have no courses"));

  // Two empty semesters at the end.
  for (const name of ["Spare A", "Spare B"]) await submit(progPage, admin, addSemesterForm, { name });
  { const t = text(await (await get(progPage, admin)).text());
    check("two empty semesters at the end are flagged as one count", t.includes("2 semesters have no courses or students yet") && t.includes("Remove them"), t.slice(t.indexOf("Spare"), t.indexOf("Spare") + 80)); }
  { const r = await submit(progPage, admin, removeForm, {});
    check("'Remove them' deletes just the empty ones and says how many", loc(r).includes("notice=semesters-removed&n=2") && (await count()) === before, `${loc(r)} ${before}`);
    check("...and the notice is gone", !text(await (await get(progPage, admin)).text()).includes("Remove them")); }

  // An empty semester in the middle (a gap), followed by a populated one: also flagged, and only the gap is removed.
  await submit(progPage, admin, addSemesterForm, { name: "Gap" });
  await submit(progPage, admin, addSemesterForm, { name: "After Gap" });
  const progHtml = await (await get(progPage, admin)).text();
  const afterGapId = progHtml.match(/id="sem-([a-z0-9]+)"[^>]*value="After Gap"/)?.[1] ?? progHtml.match(/value="After Gap"[^>]*id="sem-([a-z0-9]+)"/)?.[1];
  const quickInAfterGap = (f) => f.includes('name="semesterId"') && hasField("name")(f) && f.includes(`value="${afterGapId}"`);
  await submit(progPage, admin, quickInAfterGap, { name: `${P} Filled After Gap` });
  { const t = text(await (await get(progPage, admin)).text());
    check("a single empty semester mid-list (before a populated one) is flagged too", /Gap[\s\S]{0,40}has no courses or students yet/.test(t) && t.includes("Remove it"), t.slice(t.indexOf("has no courses") - 60, t.indexOf("has no courses") + 20)); }
  { const r = await submit(progPage, admin, removeForm, {});
    check("removing it leaves the populated semester right after it untouched", loc(r).includes("notice=semesters-removed&n=1") && (await count()) === before + 1, `${loc(r)} ${before}`);
    const t = text(await (await get(progPage, admin)).text());
    check("...'After Gap' (with its course) is still there, 'Gap' is gone", t.includes(`${P} Filled After Gap`) && !t.includes(">Gap<")); } }

// ---- 9. permissions -------------------------------------------------------------------------------------------
{ const r = await get(semPage, A.jar); check("students can't open the semester manager", r.status === 307 && loc(r) === "/dashboard", `${r.status} ${loc(r)}`); }
{ const doc = await (await get(semPage, admin)).text();
  const before = await semNames();
  const r = await submit(semPage, A.jar, addSemesterForm, { name: "Hacked Term" }, { rawHtml: doc });
  check("a student replaying the 'add semester' action changes nothing", (await semNames()).length === before.length, `${r.status} ${loc(r)}`); }
{ const block = (await (await get(semPage, admin)).text()).split("<dialog").slice(1).find((b) => dec(b).includes("Move Semester 2 students up?"));
  const before = text((await page("/dashboard", Bb.jar)).h);
  await submit(semPage, A.jar, () => true, {}, { rawHtml: block });
  check("a student replaying the 'promote' action moves nobody", text((await page("/dashboard", Bb.jar)).h) === before); }
for (const p of [semPage, "/admin/courses"]) { const r = await get(p, null); check(`signed-out ${p.replace(/c[a-z0-9]{20,}/, ":id")} -> /login`, r.status === 307 && loc(r) === "/login"); }

await db.$disconnect();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
