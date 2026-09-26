// Phase 4 end-to-end test: what students see, and what they must never see.
// Run with the app up, from the project root:  node --env-file=.env tests/e2e/student.e2e.mjs
// (it uses Prisma directly only to record "completed" activity, which the UI does not offer until Phase 5)
import { PrismaClient } from "@prisma/client";

const B = process.argv[2] ?? "http://localhost:3200";
const P = "SmokeTest";
const db = new PrismaClient();
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
const get = async (path, jar, extra = {}) => { const r = await fetch(B + path, { redirect: "manual", headers: { cookie: jar?.header ?? "", ...extra } }); jar?.store(r); return r; };
const loc = (r) => (r.headers.get("location") ?? "").replace(B, "");
const html = async (path, jar) => { const r = await get(path, jar); return { r, h: await r.text() }; };

async function submit(path, jar, pick, fields = {}, { rawHtml } = {}) {
  const page = rawHtml ?? await (await get(path, jar)).text();
  const forms = [...page.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map((m) => m[1]);
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

const admin = new Jar();
await login(admin, "admin@studyhub.local", ADMIN_PW);

// ---- build a small library through the admin screens -----------------------------------------------------------
const enc = (s) => new TextEncoder().encode(s);
const pdf = new File([enc("%PDF-1.4\n% student e2e\n%%EOF\n")], "Notes.pdf", { type: "application/pdf" });
const docx = new File([Uint8Array.from(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml\0word/document.xml\0x")]))], "Worksheet.docx");
const noFile = () => new File([], "");

async function idOf(path, re) { return (await (await get(path, admin)).text()).match(re)?.[1]; }
async function makeCourse(name) {
  await submit("/admin/courses/new", admin, hasField("name"), { name, description: "Course description", status: "PUBLISHED" });
  const id = await idOf("/admin/courses", new RegExp(`href="/admin/courses/(${CUID})"[^>]*>${name}<`));
  // Every course needs a semester now.
  await submit(`/admin/courses/${id}`, admin, hasField("count"), { count: "1" });
  const semesterId = await idOf(`/admin/courses/${id}`, new RegExp(`id="sem-(${CUID})"`));
  return { id, semesterId };
}
async function makeSubject({ id: courseId, semesterId }, name, status = "PUBLISHED") {
  await submit("/admin/subjects/new", admin, hasField("name"), { courseId, semesterId, name, description: `About ${name}`, icon: "calculator", status });
  return idOf(`/admin/subjects?course=${courseId}`, new RegExp(`href="/admin/subjects/(${CUID})"[^>]*>${name}<`));
}
async function makeChapter(subjectId, number, title, status = "PUBLISHED") {
  await submit("/admin/chapters/new", admin, hasField("title"), { subjectId, chapterNumber: String(number), title, description: `About ${title}`, status });
  return idOf(`/admin/chapters?subject=${subjectId}`, new RegExp(`href="/admin/chapters/(${CUID})"[^>]*>${title}<`));
}
async function makeMaterial(chapterId, fields) {
  await submit("/admin/materials/new", admin, hasField("title"), { status: "PUBLISHED", description: `About ${fields.title}`, chapterId, file: noFile(), ...fields });
  return idOf(`/admin/materials?chapter=${chapterId}`, new RegExp(`href="/admin/materials/(${CUID})"[^>]*>${fields.title}<`));
}

const alpha = await makeCourse(`${P} Alpha`), beta = await makeCourse(`${P} Beta`);
const sA1 = await makeSubject(alpha, `${P} Algebra`);
const sA2 = await makeSubject(alpha, `${P} Hidden Archived Subject`, "ARCHIVED");
const sA3 = await makeSubject(alpha, `${P} Empty Subject`);
const sB1 = await makeSubject(beta, `${P} Beta Biology`);
const ch1 = await makeChapter(sA1, 1, `${P} Real Numbers`);
const ch2 = await makeChapter(sA1, 2, `${P} Polynomials`);
const ch3 = await makeChapter(sA1, 3, `${P} Draft Chapter`, "DRAFT");
const ch4 = await makeChapter(sA1, 4, `${P} Empty Chapter`);
const chHid = await makeChapter(sA2, 1, `${P} Archived Subject Chapter`);
const chB = await makeChapter(sB1, 1, `${P} Cells`);
check("library scaffolded (2 classes, 4 subjects, 6 chapters)", [alpha.id, beta.id, sA1, sA2, sA3, sB1, ch1, ch2, ch3, ch4, chHid, chB].every(Boolean));

const mPdf = await makeMaterial(ch1, { type: "FILE", title: `${P} Chapter Notes`, file: pdf });
const mYt = await makeMaterial(ch1, { type: "YOUTUBE", title: `${P} Intro Video`, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", duration: "24:15" });
const mLink = await makeMaterial(ch1, { type: "LINK", title: `${P} Practice Link`, externalUrl: "https://www.khanacademy.org/math" });
const mNote = await makeMaterial(ch1, { type: "TEXT", title: `${P} Worked Note`, textContent: "<h2>Steps</h2><p>Do <strong>this</strong>.</p><script>alert(1)</script>" });
const mDraft = await makeMaterial(ch1, { type: "LINK", title: `${P} Draft Material`, externalUrl: "https://example.com/draft", status: "DRAFT" });
const mArch = await makeMaterial(ch1, { type: "LINK", title: `${P} Archived Material`, externalUrl: "https://example.com/arch", status: "ARCHIVED" });
const mDocx = await makeMaterial(ch2, { type: "FILE", title: `${P} Worksheet`, file: docx });
const mInDraftCh = await makeMaterial(ch3, { type: "LINK", title: `${P} In Draft Chapter`, externalUrl: "https://example.com/in-draft-chapter" });
const mInArchSubj = await makeMaterial(chHid, { type: "LINK", title: `${P} In Archived Subject`, externalUrl: "https://example.com/in-archived-subject" });
const mBeta = await makeMaterial(chB, { type: "TEXT", title: `${P} Beta Secret Note`, textContent: "<p>Only Beta students may read this.</p>" });
check("materials created (4 types + docx + hidden ones + a Beta note)", [mPdf, mYt, mLink, mNote, mDraft, mArch, mDocx, mInDraftCh, mInArchSubj, mBeta].every(Boolean));

async function makeStudent(name, email, courseId, { changePw = true } = {}) {
  await submit("/admin/students/new", admin, hasField("email"), { name: `${P} ${name}`, email, studentId: "", courseId, status: "ACTIVE", password: "Temp-pass-001" });
  const jar = new Jar(); await login(jar, email, "Temp-pass-001");
  if (changePw) await submit("/change-password", jar, hasField("current"), { current: "Temp-pass-001", password: "Student-pass-123", confirm: "Student-pass-123" });
  const id = (await (await get(`/admin/students?q=${email}`, admin)).text()).match(new RegExp(`href="/admin/students/(${CUID})"`))?.[1];
  return { jar, id, email };
}
const s1 = await makeStudent("Ali Khan", "smoketest.stu.ali", alpha.id);
const s2 = await makeStudent("Bea Ray", "smoketest.stu.bea", beta.id);
const s3 = await makeStudent("Cy Noclass", "smoketest.stu.cy", "");
check("students created", !!s1.id && !!s2.id && !!s3.id);

// ---- access control on every student page ----------------------------------------------------------------------
const STUDENT_PAGES = ["/dashboard", "/courses", "/subjects", "/recent", "/profile", `/courses/${alpha.id}`, `/subjects/${sA1}`, `/materials/${mPdf}`];
for (const p of STUDENT_PAGES) { const r = await get(p, null); check(`signed-out ${p.replace(/c[a-z0-9]{20,}/, ":id")} -> /login`, r.status === 307 && loc(r) === "/login", `${r.status} ${loc(r)}`); }
for (const p of ["/dashboard", `/subjects/${sA1}`, `/materials/${mPdf}`, "/recent"]) { const r = await get(p, admin); check(`admin is sent away from student page ${p.replace(/c[a-z0-9]{20,}/, ":id")}`, r.status === 307 && loc(r) === "/admin", `${r.status} ${loc(r)}`); }

// ---- dashboard -------------------------------------------------------------------------------------------------
{ const { r, h } = await html("/dashboard", s1.jar); const t = text(h);
  check("dashboard: greets the signed-in student by first name from the database", r.status === 200 && t.includes("Hi, SmokeTest!") || t.includes("Hi, SmokeTest"), t.slice(0, 120));
  check("dashboard: shows their program", t.includes(`${P} Alpha`));
  check("dashboard: subject count only counts visible subjects (Algebra + Empty; not the archived one)", /\b2\s+Subjects\b/.test(t), t.match(/\d+\s+Subjects\b/)?.[0]);
  check("dashboard: material count only counts published material in published chapters (4 + 1)", /\b5\s+Total Materials\b/.test(t), t.match(/\d+\s+Total Materials\b/)?.[0]);
  check("dashboard: shows their subjects, hides archived + other classes", t.includes(`${P} Algebra`) && !t.includes("Hidden Archived Subject") && !t.includes("Beta Biology"));
  check("dashboard: recently added lists visible material only", t.includes(`${P} Worksheet`) && !t.includes("Draft Material") && !t.includes("Archived Material") && !t.includes("In Draft Chapter") && !t.includes("Beta Secret Note"));
  check("dashboard: the bell counts this week's new material and lists it", /5 new study materials this week/.test(h), h.match(/aria-label="[^"]*study materials[^"]*"/)?.[0]);
  check("dashboard: sidebar has the student links and no admin links", ["/dashboard", "/courses", "/subjects", "/search", "/recent", "/bookmarks", "/profile"].every((p) => h.includes(`href="${p}"`)) && !h.includes('href="/admin')); }
{ const { h } = await html("/dashboard", s2.jar); const t = text(h);
  check("isolation: the Beta student sees Beta only (no Alpha names anywhere)", t.includes(`${P} Beta Biology`) && !t.includes("Alpha") && !t.includes("Algebra") && !t.includes("Worksheet") && /\b1\s+Total Materials\b/.test(t), t.match(/\d+\s+Total Materials\b/)?.[0]); }
{ const { h } = await html("/dashboard", s3.jar); const t = text(h);
  check("dashboard: a student with no class sees a clear message", t.includes("You haven't been assigned to a program yet"), t.slice(0, 200));
  check("...with zero counts and no other class's data", /\b0\s+Subjects\b/.test(t) && /\b0\s+Total Materials\b/.test(t) && !t.includes(P + " Algebra") && !t.includes("Beta Biology")); }

// ---- my courses / class page / subjects list ------------------------------------------------------------------
{ const t = text((await html("/courses", s1.jar)).h); check("my courses: lists only their class, with counts", t.includes(`${P} Alpha`) && !t.includes(`${P} Beta`) && /2 subjects/.test(t) && /5 materials/.test(t), t.slice(0, 250)); }
{ const { r, h } = await html(`/courses/${alpha.id}`, s1.jar); const t = text(h);
  check("program page: subjects + breadcrumb", r.status === 200 && t.includes(`${P} Algebra`) && t.includes(`${P} Empty Subject`) && !t.includes("Hidden Archived Subject") && t.includes("My Courses")); }
{ const r = await get(`/courses/${beta.id}`, s1.jar); const raw = await r.text(); check("program page: another program -> 404 with the permission message", r.status === 404 && raw.includes("permission to access it"), `${r.status}`); }
{ const t = text((await html("/subjects", s1.jar)).h); check("subjects list: their visible subjects only", t.includes(`${P} Algebra`) && t.includes(`${P} Empty Subject`) && !t.includes("Hidden Archived") && !t.includes("Beta Biology")); }
{ const t = text((await html("/courses", s3.jar)).h); check("no class: /courses shows the friendly empty state", t.includes("You haven't been assigned to a program yet")); }
{ const t = text((await html("/subjects", s3.jar)).h); check("no class: /subjects shows the friendly empty state", t.includes("You haven't been assigned to a program yet")); }

// ---- subject page ----------------------------------------------------------------------------------------------
{ const { r, h } = await html(`/subjects/${sA1}`, s1.jar); const t = text(h);
  check("subject: header with name, class and description", r.status === 200 && t.includes(`${P} Algebra`) && t.includes(`${P} Alpha`) && t.includes(`About ${P} Algebra`));
  check("subject: breadcrumb My Courses > Class > Subject", t.includes("My Courses") && h.includes(`href="/courses/${alpha.id}"`));
  check("subject: shows published chapters, hides the draft chapter", t.includes(`${P} Real Numbers`) && t.includes(`${P} Polynomials`) && t.includes(`${P} Empty Chapter`) && !t.includes("Draft Chapter") && !t.includes("In Draft Chapter"));
  check("subject: chapter material counts are right (4, 1, 0)", /Real Numbers[^]*?4 materials/.test(t) && /Polynomials[^]*?1 material\b/.test(t) && /Empty Chapter[^]*?0 materials/.test(t));
  check("subject: hides draft/archived materials", !t.includes("Draft Material") && !t.includes("Archived Material"));
  check("subject: the first chapter with material is open, others closed", new RegExp(`<details[^>]*id="chapter-${ch1}"[^>]*open`).test(h) && !new RegExp(`<details[^>]*id="chapter-${ch2}"[^>]*open`).test(h));
  check("subject: an empty chapter says so", t.includes("No study material has been added to this chapter yet"));
  check("subject: each type has its own action — Download, Watch Video, Open Link, Read", h.includes(`href="/api/materials/${mPdf}/file?download=1"`) && h.includes(`href="/materials/${mYt}"`) && h.includes(`href="/api/materials/${mLink}/open"`) && h.includes(`href="/materials/${mNote}"`) && ["Download", "Watch Video", "Open Link", "Read"].every((a) => t.includes(a)));
  check("subject: external links open in a new tab safely", new RegExp(`href="/api/materials/${mLink}/open"[^>]*target="_blank"[^>]*rel="noopener noreferrer"`).test(h));
  check("subject: shows file size and duration", /PDF · \d+ B/.test(t) && t.includes("24:15"));
  check("subject: progress starts at 0 / 2 chapters (empty + draft chapters aren't counted)", /0 \/ 2 chapters/.test(t) && /aria-valuenow="0"/.test(h), t.match(/\d+ \/ \d+ chapters/)?.[0]); }
{ const { h } = await html(`/subjects/${sA1}?chapter=${ch2}`, s1.jar);
  check("subject: ?chapter= opens that chapter", new RegExp(`<details[^>]*id="chapter-${ch2}"[^>]*open`).test(h)); }
{ const t = text((await html(`/subjects/${sA1}?tab=about`, s1.jar)).h);
  check("about tab: real counts (3 chapters, 2 documents, 1 video, 1 link, 1 note)", /Chapters\s+3/.test(t) && /Documents\s+2/.test(t) && /Videos\s+1/.test(t) && /Links\s+1/.test(t) && /Notes\s+1/.test(t), t.slice(t.indexOf("About") , t.indexOf("About") + 220)); }
{ const t = text((await html(`/subjects/${sA1}?tab=recommended`, s1.jar)).h);
  check("recommended tab: 'Up next' lists unopened material in study order", t.includes("Up next") && t.includes(`${P} Chapter Notes`) && t.includes(`${P} Worksheet`) && !t.includes("Draft Material")); }
{ const r = await get(`/subjects/${sA1}?tab=EVIL&chapter=%27--`, s1.jar); check("junk tab/chapter params are ignored safely", r.status === 200, String(r.status)); }
{ const t = text((await html(`/subjects/${sA3}`, s1.jar)).h); check("a subject with no chapters shows the empty message", t.includes("No chapters have been added yet")); }
for (const [label, id] of [["archived subject", sA2], ["another program's subject", sB1], ["unknown id", "clxxxxxxxxxxxxxxxxxxxxxxx"], ["malformed id", "not-an-id"]]) {
  const r = await get(`/subjects/${id}`, s1.jar); const raw = await r.text(); const t = text(raw);
  check(`subject: ${label} -> 404 with the permission message`, r.status === 404 && raw.includes("permission to access it") && !t.includes("Biology") && !t.includes("Hidden Archived"), `${r.status}`);
}

// ---- material pages --------------------------------------------------------------------------------------------
{ const { r, h } = await html(`/materials/${mPdf}`, s1.jar);
  check("material: PDF is embedded through the permission-checked route, with a Download button", r.status === 200 && h.includes(`src="/api/materials/${mPdf}/file"`) && h.includes(`/api/materials/${mPdf}/file?download=1`)); }
{ const { h } = await html(`/materials/${mYt}`, s1.jar);
  check("material: YouTube plays in the privacy-friendly embedded player", h.includes("youtube-nocookie.com/embed/dQw4w9WgXcQ") && text(h).includes("24:15")); }
{ const { h } = await html(`/materials/${mLink}`, s1.jar);
  check("material: link page offers Open Link via the checked redirect", h.includes(`href="/api/materials/${mLink}/open"`) && text(h).includes("khanacademy.org")); }
{ const { h } = await html(`/materials/${mNote}`, s1.jar);
  check("material: note renders formatting", h.includes("<h2>Steps</h2>") && h.includes("<strong>this</strong>"));
  check("material: note never ships a script from the author", !/<script>alert\(1\)/i.test(h) && !/on(error|load|click)=/i.test(h.slice(h.indexOf('class="note'))), ""); }
{ const { h } = await html(`/materials/${mDocx}`, s1.jar);
  check("material: Word file is offered as a download (no preview)", h.includes(`/api/materials/${mDocx}/file?download=1`) && text(h).includes("Worksheet.docx") && !h.includes("<iframe")); }
{ const { h } = await html(`/materials/${mYt}`, s1.jar);
  check("material: previous/next stay inside the chapter, in order (PDF < video < link < note)", h.includes(`href="/materials/${mPdf}"`) && h.includes(`href="/materials/${mLink}"`) && /2 of 4 in this chapter/.test(text(h)), text(h).match(/\d of \d in this chapter/)?.[0]); }
{ const { h } = await html(`/materials/${mNote}`, s1.jar); check("material: the last item has no 'next' link", /4 of 4/.test(text(h)) && !h.includes(`href="/materials/${mDraft}"`) && !h.includes(`href="/materials/${mArch}"`)); }
{ const { h } = await html(`/materials/${mPdf}`, s1.jar);
  check("material: breadcrumb goes back to the chapter", h.includes(`href="/subjects/${sA1}?chapter=${ch1}#chapter-${ch1}"`)); }
for (const [label, id] of [["a draft material", mDraft], ["an archived material", mArch], ["material in a draft chapter", mInDraftCh], ["material in an archived subject", mInArchSubj], ["another program's material", mBeta], ["unknown id", "clxxxxxxxxxxxxxxxxxxxxxxx"], ["malformed id", "../../etc/passwd"]]) {
  const r = await get(`/materials/${encodeURIComponent(id)}`, s1.jar); const raw = await r.text(); const t = text(raw);
  check(`material: ${label} -> 404 with the permission message`, r.status === 404 && raw.includes("permission to access it") && !t.includes("Only Beta students") && !t.includes("example.com"), `${r.status}`);
}
{ const r = await get(`/materials/${mPdf}`, s2.jar); check("material: the Beta student can't open an Alpha material", r.status === 404); }
{ const { r, h } = await html(`/materials/${mBeta}`, s2.jar); check("material: ...but can open their own", r.status === 200 && text(h).includes("Only Beta students may read this")); }

// ---- link redirect route ---------------------------------------------------------------------------------------
const open = (id, jar) => fetch(`${B}/api/materials/${id}/open`, { redirect: "manual", headers: { cookie: jar?.header ?? "" } });
{ const r = await open(mLink, s1.jar); check("open link: student is redirected to the external site with no referrer", r.status === 302 && r.headers.get("location") === "https://www.khanacademy.org/math" && r.headers.get("referrer-policy") === "no-referrer", `${r.status} ${r.headers.get("location")}`); }
{ const r = await open(mLink, s2.jar); check("open link: student from another program -> 403", r.status === 403, String(r.status)); }
{ const r = await open(mLink, null); check("open link: signed out -> 401", r.status === 401, String(r.status)); }
{ const r = await open(mPdf, s1.jar); check("open link: a non-link material -> 404", r.status === 404, String(r.status)); }
{ const r = await open(mDraft, s1.jar); check("open link: draft link -> 403", r.status === 403, String(r.status)); }
{ const r = await open("not-an-id", s1.jar); check("open link: malformed id -> 404", r.status === 404); }

// ---- recent materials ------------------------------------------------------------------------------------------
{ const { h } = await html("/recent", s1.jar); const t = text(h);
  const order = [...t.matchAll(new RegExp(`${P} (Worksheet|Worked Note|Practice Link|Intro Video|Chapter Notes)`, "g"))].map((m) => m[1]);
  check("recent: newest first, visible only", order[0] === "Worksheet" && order.length >= 5 && !t.includes("Draft Material") && !t.includes("Beta Secret"), order.join(", ")); }
for (let i = 1; i <= 22; i++) await makeMaterial(chB, { type: "LINK", title: `${P} Bulk ${String(i).padStart(2, "0")}`, externalUrl: `https://example.com/${i}` });
{ const p1 = text((await html("/recent", s2.jar)).h), p2 = text((await html("/recent?page=2", s2.jar)).h);
  check("recent: pagination (23 items -> 20 + 3)", /Showing 1\s*.\s*20 of 23/.test(p1) && /Showing 21\s*.\s*23 of 23/.test(p2), p1.match(/Showing[^N]{0,25}/)?.[0]);
  check("recent: page 1 starts with the newest", p1.indexOf("Bulk 22") !== -1 && p1.indexOf("Bulk 22") < p1.indexOf("Bulk 21")); }
{ const r = await get("/recent?page=-4", s2.jar); check("recent: junk page number is handled", r.status === 200); }
{ const t = text((await html("/recent", s3.jar)).h); check("recent: no class -> empty state", t.includes("No study material has been added yet")); }
{ const h = (await html("/dashboard", s2.jar)).h; check("bell: caps the badge at 9+", />9\+</.test(h)); }

// ---- progress (recorded straight in the database; the UI for it arrives with Phase 5) --------------------------
{ // Completing the only material in Polynomials completes that chapter: 1 of 2 chapters.
  // upsert, not create: visiting a material's page (which several earlier checks in this suite already did)
  // now records it as "opened" on its own, so a row may already exist here.
  await db.materialProgress.upsert({ where: { userId_materialId: { userId: s1.id, materialId: mDocx } }, create: { userId: s1.id, materialId: mDocx, completedAt: new Date() }, update: { completedAt: new Date() } });
  const { h } = await html(`/subjects/${sA1}`, s1.jar); const t = text(h);
  check("progress: one finished chapter shows 1 / 2 chapters, 50%", /1 \/ 2 chapters/.test(t) && /aria-valuenow="50"/.test(h) && /Chapter completed/.test(h), t.match(/\d+ \/ \d+ chapters/)?.[0]);
  const d = text((await html("/dashboard", s1.jar)).h); check("progress: the dashboard shows the same overall percentage", /\b50%\s+Your progress\b/.test(d), d.match(/\d+%\s+Your progress\b/)?.[0]);
  // Finishing every *visible* material in Real Numbers completes it, even though hidden drafts were never completed.
  for (const id of [mPdf, mYt, mLink, mNote]) await db.materialProgress.upsert({ where: { userId_materialId: { userId: s1.id, materialId: id } }, create: { userId: s1.id, materialId: id, completedAt: new Date() }, update: { completedAt: new Date() } });
  const t2 = text((await html(`/subjects/${sA1}`, s1.jar)).h);
  check("progress: hidden draft/archived material never blocks completion (2 / 2, 100%)", /2 \/ 2 chapters/.test(t2) && /Overall Progress[^]*100\s*%/.test(t2), t2.match(/\d+ \/ \d+ chapters/)?.[0]);
  const t3 = text((await html("/dashboard", s2.jar)).h); check("progress: one student's progress never appears for another", /\b0%\s+Your progress\b/.test(t3)); }
{ const other = text((await html("/courses", s1.jar)).h); check("progress: the program card reflects it", /100\s*%/.test(other)); }

// ---- live changes by the admin show up at once -----------------------------------------------------------------
const status = async (listPath, id, st) => { const page = await (await get(listPath, admin)).text(); await submit(listPath, admin, (f) => hidden("id", id)(f) && hidden("status", st)(f), {}, { rawHtml: page }); };
{ await status(`/admin/chapters?subject=${sA1}`, ch2, "ARCHIVED");
  const t = text((await html(`/subjects/${sA1}`, s1.jar)).h); const d = text((await html("/dashboard", s1.jar)).h);
  check("admin archives a chapter -> it disappears for the student, and totals drop", !t.includes("Polynomials") && /\b4\s+Total Materials\b/.test(d), d.match(/\d+\s+Total Materials\b/)?.[0]);
  check("...and its material can no longer be opened", (await get(`/materials/${mDocx}`, s1.jar)).status === 404);
  await status(`/admin/chapters?subject=${sA1}`, ch2, "PUBLISHED"); check("...and comes back when published again", text((await html(`/subjects/${sA1}`, s1.jar)).h).includes("Polynomials")); }
{ const before = (await html("/recent", s1.jar)).h.includes("Worksheet");
  const page = await (await get("/admin/students", admin)).text();
  await submit("/admin/students", admin, (f) => hidden("id", s1.id)(f) && hidden("status", "INACTIVE")(f), {}, { rawHtml: page });
  const r = await get("/dashboard", s1.jar);
  check("admin deactivates a student -> their session ends at once", before && r.status === 307 && loc(r) === "/login", `${r.status} ${loc(r)}`); }

// ---- profile ---------------------------------------------------------------------------------------------------
{ const { r, h } = await html("/profile", s2.jar); const t = text(h);
  check("profile: shows their own details (name, sign-in, class)", r.status === 200 && t.includes(`${P} Bea Ray`) && t.includes(s2.email) && t.includes(`${P} Beta`) && !t.includes("Alpha")); }
{ const r = await submit("/profile", s2.jar, hasField("current"), { current: "wrong", password: "Another-pass-123", confirm: "Another-pass-123" }); check("profile: wrong current password is rejected", r.status === 200 && text(await r.text()).includes("current password is incorrect")); }
{ const r = await submit("/profile", s2.jar, hasField("current"), { current: "Student-pass-123", password: "Another-pass-123", confirm: "Another-pass-123" });
  check("profile: password change works and returns to the dashboard with a notice", loc(r) === "/dashboard?notice=password-changed", `${r.status} ${loc(r)}`);
  check("...the notice is shown", text((await html("/dashboard?notice=password-changed", s2.jar)).h).includes("Your password was changed"));
  const j = new Jar(); const lr = await login(j, s2.email, "Another-pass-123"); check("...and the new password signs in", loc(lr) === "/dashboard"); }

await db.$disconnect();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
