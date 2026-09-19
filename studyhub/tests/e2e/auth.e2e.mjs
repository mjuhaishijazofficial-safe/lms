// Phase 1 auth smoke test: posts the login form exactly like a no-JS browser would.
const B = process.argv[2] ?? "http://localhost:3200";
const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD;
if (!ADMIN_PW) { console.error("Run with the .env loaded:  node --env-file=.env <this file>"); process.exit(1); }
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); if (!ok) fails++; };
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'");

class Jar {
  c = new Map();
  store(res) { for (const h of res.headers.getSetCookie()) { const [kv] = h.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (v === "" || /max-age=0|expires=thu, 01 jan 1970/i.test(h)) this.c.delete(k); else this.c.set(k, v); this.last = h; } }
  get header() { return [...this.c].map(([k, v]) => `${k}=${v}`).join("; "); }
}
async function get(path, jar, extra = {}) {
  const res = await fetch(B + path, { redirect: "manual", headers: { cookie: jar?.header ?? "", ...extra } });
  jar?.store(res); return res;
}
async function postForm(path, jar, fields, pageHtml) {
  const html = pageHtml ?? await (await get(path, jar)).text();
  const fd = new FormData();
  for (const m of html.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g)) fd.append(unescape(m[1]), unescape(m[2] ?? ""));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(B + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: jar.header, origin: B } });
  jar.store(res); return res;
}
const loc = (r) => (r.headers.get("location") ?? "").replace(B, "");
const login = async (jar, email, password) => postForm("/login", jar, { email, password });

// signed out
for (const p of ["/dashboard", "/admin", "/admin/anything"]) { const r = await get(p); check(`signed-out ${p} -> /login`, r.status === 307 && loc(r) === "/login", `${r.status} ${loc(r)}`); }

// wrong password shows generic error, sets no session
{ const jar = new Jar(); const r = await login(jar, "admin@studyhub.local", "wrong"); const t = await r.text();
  check("wrong password rejected", r.status === 200 && t.includes("Incorrect email or password") && !jar.c.has("studyhub_session"), `${r.status}`); }
// unknown user: same generic message
{ const jar = new Jar(); const r = await login(jar, "nobody@x.com", "whatever"); check("unknown user: same generic error", (await r.text()).includes("Incorrect email or password")); }

// admin
const admin = new Jar();
{ const r = await login(admin, "  ADMIN@studyhub.local ", ADMIN_PW); check("admin login -> /admin", loc(r) === "/admin" && admin.c.has("studyhub_session"), `${r.status} ${loc(r)}`);
  check("session cookie HttpOnly + SameSite=Lax", /HttpOnly/i.test(admin.last) && /SameSite=lax/i.test(admin.last), admin.last?.split(";").slice(1).join(";")); }
{ const r = await get("/admin", admin); check("admin sees the real admin dashboard", r.status === 200 && (await r.text()).includes("Hi, Admin!")); }
{ const r = await get("/dashboard", admin); check("admin on /dashboard -> /admin", loc(r) === "/admin", `${r.status} ${loc(r)}`); }
{ const r = await get("/login", admin); check("admin on /login -> /admin", loc(r) === "/admin", `${r.status} ${loc(r)}`); }

// student
const student = new Jar();
{ const r = await login(student, "ali@studyhub.local", "Student-Demo-2026"); check("student login -> /dashboard", loc(r) === "/dashboard", `${r.status} ${loc(r)}`); }
{ const r = await get("/dashboard", student); const t = await r.text(); check("student dashboard greets by first name from the database", r.status === 200 && t.replace(/<!-- -->/g, "").includes("Hi, Ali!"), t.slice(0, 200)); }
{ const r = await get("/admin", student); check("student BLOCKED from /admin", r.status === 307 && loc(r) === "/dashboard", `${r.status} ${loc(r)}`); }

// forged / stolen-looking cookies
{ const r = await get("/dashboard", null, { cookie: "studyhub_session=forged-token" }); check("forged cookie rejected", loc(r) === "/login", `${r.status} ${loc(r)}`); }

// logout invalidates the session server-side (old token no longer works)
{ const oldToken = student.c.get("studyhub_session");
  const html = await (await get("/dashboard", student)).text();
  const r = await postForm("/dashboard", student, {}, html);
  check("logout -> /login", loc(r) === "/login", `${r.status} ${loc(r)}`);
  const r2 = await get("/dashboard", null, { cookie: `studyhub_session=${oldToken}` });
  check("old session token dead after logout", loc(r2) === "/login", `${r2.status} ${loc(r2)}`); }

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
