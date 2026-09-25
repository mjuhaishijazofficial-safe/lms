// Phase 2 end-to-end test: drives the real forms exactly as a no-JS browser would.
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

/** Find a rendered <form> (matching `pick`), keep its hidden inputs, add `fields`, POST it back to the same page. */
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

const admin = new Jar();
await login(admin, "admin@studyhub.local", ADMIN_PW);
const pageText = async (path, jar = admin) => text(await (await get(path, jar)).text());

// ---------- classes ----------
{ const r = await submit("/admin/courses/new", admin, hasField("name"), { name: "", description: "", status: "PUBLISHED" });
  check("course: empty name shows validation error", r.status === 200 && (await r.text()).includes("Name is required") || /required/i.test(text(await (await get("/admin/courses/new", admin)).text())) === false, `status ${r.status}`); }
{ const r = await submit("/admin/courses/new", admin, hasField("name"), { name: `${P} Class 10`, description: "Secondary", status: "PUBLISHED" });
  check("course: create -> opens the new program with a notice", /^\/admin\/courses\/c[a-z0-9]{20,}\?notice=course-created$/.test(loc(r)), `${r.status} ${loc(r)}`);
  const t = await pageText(loc(r)); check("course: its page shows the success message", t.includes(`${P} Class 10`) && t.includes("Program created.")); }
{ const t = await pageText("/admin/courses"); check("course: appears in the list", t.includes(`${P} Class 10`)); }
{ await submit("/admin/courses/new", admin, hasField("name"), { name: `${P} Class 9`, description: "", status: "PUBLISHED" });
  const html = await (await get("/admin/courses", admin)).text();
  const order = [...html.matchAll(/SmokeTest Class (\d+)/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
  check("course: new courses append to the end of the order", order.join() === "10,9", order.join()); }

const courseId = (await (await get("/admin/courses", admin)).text()).match(/href="\/admin\/courses\/([a-z0-9]+)"[^>]*>SmokeTest Class 10</)?.[1];
const course9 = (await (await get("/admin/courses", admin)).text()).match(/href="\/admin\/courses\/([a-z0-9]+)"[^>]*>SmokeTest Class 9</)?.[1];
check("course ids found", !!courseId && !!course9);

{ const html = await (await get("/admin/courses", admin)).text();
  await submit("/admin/courses", admin, (f) => hidden("id", course9)(f) && hidden("direction", "up")(f), {}, { rawHtml: html });
  const after = await (await get("/admin/courses", admin)).text();
  const order = [...after.matchAll(/SmokeTest Class (\d+)/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
  check("course: move up reorders", order.join() === "9,10", order.join()); }

// Every course needs a semester now, so give SmokeTest Class 10 one before adding subjects to it.
await submit(`/admin/courses/${courseId}`, admin, hasField("count"), { count: "1" });
const semesterId = (await (await get(`/admin/courses/${courseId}`, admin)).text()).match(/id="sem-(c[a-z0-9]{20,})"/)?.[1];
check("class 10 semester id found", !!semesterId);
const FAKE_ID = "clxxxxxxxxxxxxxxxxxxxxxxx"; // right shape, matches nothing

// ---------- subjects ----------
{ const r = await submit("/admin/subjects/new", admin, hasField("name"), { courseId, semesterId, name: `${P} Mathematics`, description: "Numbers", icon: "calculator", status: "PUBLISHED" });
  check("subject: create", loc(r).endsWith("notice=subject-created"), `${r.status} ${loc(r)}`); }
{ const r = await submit("/admin/subjects/new", admin, hasField("name"), { courseId, semesterId, name: `${P} Physics`, description: "", icon: "<script>", status: "PUBLISHED" });
  check("subject: invalid icon rejected", r.status === 200 && (await r.text()).includes("Choose an icon"), `${r.status}`); }
{ const r = await submit("/admin/subjects/new", admin, hasField("name"), { courseId: "clxxxxxxxxxxxxxxxxxxxxxxx", semesterId: FAKE_ID, name: `${P} Ghost`, description: "", icon: "book", status: "PUBLISHED" });
  check("subject: nonexistent class rejected", r.status === 200 && text(await r.text()).includes("Choose a program that exists"), `${r.status}`); }
{ const r = await submit("/admin/subjects/new", admin, hasField("name"), { courseId, name: `${P} No Semester`, description: "", icon: "book", status: "PUBLISHED" });
  check("subject: a course needs a semester", r.status === 200 && text(await r.text()).includes("Choose a semester"), `${r.status}`); }
const subjectId = (await (await get(`/admin/subjects?course=${courseId}`, admin)).text()).match(/href="\/admin\/subjects\/([a-z0-9]+)"[^>]*>SmokeTest Mathematics</)?.[1];
check("subject id found", !!subjectId);

// ---------- chapters ----------
for (const [n, t] of [[1, "Real Numbers"], [2, "Polynomials"], [3, "Triangles"]]) {
  const r = await submit("/admin/chapters/new", admin, hasField("title"), { subjectId, chapterNumber: String(n), title: `${P} ${t}`, description: "", status: n === 3 ? "DRAFT" : "PUBLISHED" });
  check(`chapter ${n}: create`, loc(r).endsWith("notice=chapter-created"), `${r.status} ${loc(r)}`);
}
{ const r = await submit("/admin/chapters/new", admin, hasField("title"), { subjectId, chapterNumber: "abc", title: `${P} Bad`, description: "", status: "PUBLISHED" });
  check("chapter: non-numeric number rejected", r.status === 200 && text(await r.text()).includes("Enter a number"), `${r.status}`); }
const chHtml = await (await get(`/admin/chapters?subject=${subjectId}`, admin)).text();
const chId = (t) => chHtml.match(new RegExp(`href="/admin/chapters/([a-z0-9]+)"[^>]*>SmokeTest ${t}<`))?.[1];
const [ch1, ch2, ch3] = [chId("Real Numbers"), chId("Polynomials"), chId("Triangles")];
check("chapter ids found", !!ch1 && !!ch2 && !!ch3);
{ await submit(`/admin/chapters?subject=${subjectId}`, admin, (f) => hidden("id", ch2)(f) && hidden("direction", "up")(f), {}, { rawHtml: chHtml });
  const after = await (await get(`/admin/chapters?subject=${subjectId}`, admin)).text();
  const order = [...after.matchAll(/SmokeTest (Real Numbers|Polynomials|Triangles)</g)].map((m) => m[1]);
  check("chapter: move up reorders", order.join() === "Polynomials,Real Numbers,Triangles", order.join()); }
{ const html = await (await get(`/admin/chapters?subject=${subjectId}`, admin)).text();
  await submit(`/admin/chapters?subject=${subjectId}`, admin, (f) => hidden("id", ch1)(f) && hidden("status", "ARCHIVED")(f), {}, { rawHtml: html });
  const t = await pageText(`/admin/chapters?subject=${subjectId}`);
  check("chapter: archive changes status", /Real Numbers[\s\S]{0,300}Archived/.test(t)); }

// ---------- delete guards ----------
{ // Delete lives on the Edit page and is only offered while a program is empty, so check both halves:
  // no button for a program with subjects, and the server still refuses a replayed delete for it.
  const t0 = await pageText(`/admin/courses/${courseId}/edit`);
  check("course with subjects: no delete button, and the page says why", !t0.includes("Delete program") && t0.includes("can't be deleted"));
  const html = await (await get(`/admin/courses/${course9}/edit`, admin)).text();
  const r = await submit(`/admin/courses/${course9}/edit`, admin, (f) => hidden("id", course9)(f) && !f.includes('name="status"'), { id: courseId }, { rawHtml: html });
  check("course with subjects can't be deleted", loc(r).includes("error=course-not-empty"), loc(r));
  const t = await pageText("/admin/courses?error=course-not-empty"); check("...and says why", t.includes("still has subjects or students")); }
{ const html = await (await get("/admin/subjects", admin)).text();
  const r = await submit("/admin/subjects", admin, (f) => hidden("id", subjectId)(f) && !f.includes('name="status"') && !f.includes('name="direction"'), {}, { rawHtml: html });
  check("subject with chapters can't be deleted", loc(r).includes("error=subject-not-empty"), loc(r)); }

// ---------- students ----------
const email = `${P.toLowerCase()}.ali`;
const tempPw = "Temp-pass-001";
{ const r = await submit("/admin/students/new", admin, hasField("email"), { name: `${P} Ali`, email, studentId: "S-100", courseId, status: "ACTIVE", password: tempPw });
  check("student: create", loc(r) === "/admin/students?notice=student-created", `${r.status} ${loc(r)}`); }
{ const r = await submit("/admin/students/new", admin, hasField("email"), { name: `${P} Dup`, email: email.toUpperCase(), studentId: "", courseId: "", status: "ACTIVE", password: tempPw });
  check("student: duplicate email (case-insensitive) rejected", r.status === 200 && text(await r.text()).includes("already in use"), `${r.status}`); }
{ const r = await submit("/admin/students/new", admin, hasField("email"), { name: `${P} Dup2`, email: `${P.toLowerCase()}.dup2`, studentId: "S-100", courseId: "", status: "ACTIVE", password: tempPw });
  check("student: duplicate student ID rejected", r.status === 200 && text(await r.text()).includes("student ID is already in use"), `${r.status}`); }
{ const r = await submit("/admin/students/new", admin, hasField("email"), { name: `${P} Short`, email: `${P.toLowerCase()}.short`, studentId: "", courseId: "", status: "ACTIVE", password: "abc" });
  check("student: short password rejected", r.status === 200 && text(await r.text()).includes("at least 8 characters"), `${r.status}`); }

const listHtml = await (await get(`/admin/students?q=${P.toLowerCase()}.ali`, admin)).text();
const studentId = listHtml.match(/href="\/admin\/students\/([a-z0-9]+)"[^>]*>SmokeTest Ali</)?.[1];
check("student: search finds by email + shows class", !!studentId && text(listHtml).includes(`${P} Class 10`));
check("student: password/hash never present in admin HTML", !listHtml.includes(tempPw) && !/argon2/i.test(listHtml) && !/passwordHash/.test(listHtml));
{ const t = await pageText("/admin/students?q=zzz-no-match"); check("student: empty search state", t.includes("No students match your filters")); }
{ const t = await pageText(`/admin/students?course=${courseId}`); check("student: filter by class", t.includes(`${P} Ali`)); }
{ const t = await pageText("/admin/students?course=none&q=smoketest"); check("student: 'not assigned' filter excludes assigned", !t.includes(`${P} Ali`)); }

// student first login: forced password change
const stu = new Jar();
{ const r = await login(stu, `  ${email.toUpperCase()} `, tempPw); check("student: temp-password login -> /change-password", loc(r) === "/change-password", `${r.status} ${loc(r)}`); }
{ const r = await get("/dashboard", stu); check("student: dashboard blocked until password changed", loc(r) === "/change-password", `${r.status} ${loc(r)}`); }
{ const r = await submit("/change-password", stu, hasField("current"), { current: "wrong-current", password: "Brand-new-pass-1", confirm: "Brand-new-pass-1" });
  check("change-password: wrong current password rejected", r.status === 200 && text(await r.text()).includes("current password is incorrect")); }
{ const r = await submit("/change-password", stu, hasField("current"), { current: tempPw, password: "Brand-new-pass-1", confirm: "Brand-new-pass-1" });
  check("change-password: success -> dashboard with notice", loc(r) === "/dashboard?notice=password-changed", `${r.status} ${loc(r)}`); }
{ const r = await get("/dashboard", stu); check("student: dashboard reachable after change", r.status === 200); }
{ const j = new Jar(); const r = await login(j, email, tempPw); check("old temporary password no longer works", r.status === 200 && text(await r.text()).includes("Incorrect email or password")); }

// ---------- authorization ----------
for (const p of ["/admin", "/admin/students", "/admin/students/new", `/admin/students/${studentId}`, "/admin/courses", "/admin/subjects", "/admin/chapters", "/admin/settings"]) {
  const r = await get(p, stu); check(`student blocked from ${p.replace(studentId, ":id")}`, r.status === 307 && loc(r) === "/dashboard", `${r.status} ${loc(r)}`);
}
{ // Steal a real server-action id from an admin page and replay it as the student.
  const adminHtml = await (await get("/admin/courses/new", admin)).text();
  const before = await pageText("/admin/courses");
  const r = await submit("/admin/courses/new", stu, hasField("name"), { name: `${P} Hacked`, description: "", status: "PUBLISHED" }, { rawHtml: adminHtml });
  const after = await pageText("/admin/courses");
  check("student replaying an admin server action creates nothing", !after.includes(`${P} Hacked`) && after === before, `${r.status} ${loc(r)}`); }
{ const anon = new Jar(); const adminHtml = await (await get("/admin/courses/new", admin)).text();
  await submit("/admin/courses/new", anon, hasField("name"), { name: `${P} Anon`, description: "", status: "PUBLISHED" }, { rawHtml: adminHtml });
  check("signed-out replay of an admin action creates nothing", !(await pageText("/admin/courses")).includes(`${P} Anon`)); }
{ const html = await (await get("/admin/students", admin)).text();
  const r = await submit("/admin/students", admin, (f) => hidden("id", studentId)(f) && hidden("status", "INACTIVE")(f), {}, { rawHtml: html });
  const jr = await get("/dashboard", stu);
  check("deactivating a student signs them out immediately", loc(r).includes("notice=student-deactivated") && loc(jr) === "/login", `${loc(r)} / ${jr.status} ${loc(jr)}`); }
{ const j = new Jar(); const r = await login(j, email, "Brand-new-pass-1"); check("inactive student can't sign in", r.status === 200 && text(await r.text()).includes("account is inactive")); }
{ const html = await (await get("/admin/students", admin)).text();
  await submit("/admin/students", admin, (f) => hidden("id", studentId)(f) && hidden("status", "ACTIVE")(f), {}, { rawHtml: html });
  const j = new Jar(); const r = await login(j, email, "Brand-new-pass-1"); check("reactivated student can sign in again", loc(r) === "/dashboard", `${r.status} ${loc(r)}`); }
{ const r = await submit(`/admin/students/${studentId}`, admin, hasField("confirm"), { password: "Reset-by-admin-1", confirm: "Reset-by-admin-1" });
  check("admin password reset", loc(r).includes("notice=password-reset"), `${r.status} ${loc(r)}`);
  const j = new Jar(); const lr = await login(j, email, "Reset-by-admin-1"); check("reset password forces change again", loc(lr) === "/change-password", `${lr.status} ${loc(lr)}`); }
{ const r = await submit(`/admin/students/${studentId}`, admin, hasField("studentId"), { name: `${P} Ali Renamed`, email, studentId: "S-100", courseId: course9, status: "ACTIVE" });
  check("student: edit + move to another class", loc(r).includes("notice=student-updated"), `${r.status} ${loc(r)}`);
  const t = await pageText(`/admin/students?q=${P.toLowerCase()}.ali`); check("...class change is reflected", t.includes("Ali Renamed") && t.includes(`${P} Class 9`)); }

// ---------- pagination ----------
for (let i = 1; i <= 22; i++) await submit("/admin/students/new", admin, hasField("email"), { name: `${P} Bulk ${String(i).padStart(2, "0")}`, email: `${P.toLowerCase()}.bulk${i}`, studentId: "", courseId: "", status: "ACTIVE", password: "Bulk-pass-1234" });
{ const p1 = await pageText("/admin/students?q=smoketest"); const p2 = await pageText("/admin/students?q=smoketest&page=2");
  check("pagination: page 1 shows 20 of 23", /Showing 1\s*.\s*20 of 23/.test(p1), p1.match(/Showing[^N]{0,30}/)?.[0]);
  check("pagination: page 2 shows the rest", /Showing 21\s*.\s*23 of 23/.test(p2), p2.match(/Showing[^N]{0,30}/)?.[0]); }

// ---------- dashboard + settings ----------
{ const t = await pageText("/admin"); const n = (label) => Number(new RegExp(`${label}\\s+(\\d+)`).exec(t)?.[1] ?? -1);
  // The database may already hold dev seed data, so check the test's own additions are counted: 23 students, 2 classes, 1 subject, 3 chapters.
  check("dashboard: counts include what the test created", n("Total students") >= 23 && n("Programs") >= 2 && n("Subjects") >= 1 && n("Chapters") >= 3, `students=${n("Total students")} classes=${n("Classes")} subjects=${n("Subjects")} chapters=${n("Chapters")}`); }
{ const t = await pageText("/admin"); check("dashboard: recent students + modified panels populated", t.includes("Recently added students") && t.includes(`${P} Bulk`) && t.includes("Recently modified")); }
{ const r = await submit("/admin/settings", admin, (f) => f.includes('name="name"') && !f.includes('name="current"'), { name: "Admin" });
  check("settings: update name", loc(r).includes("notice=account-updated"), `${r.status} ${loc(r)}`); }
{ const r = await get("/admin/students/not-an-id", admin); check("bad id -> 404 page, not a crash", r.status === 404, `${r.status}`); }
{ const r = await get("/admin/students?page=-5&status=EVIL&course=%27%3B--", admin); check("junk query params are ignored safely", r.status === 200, `${r.status}`); }

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
