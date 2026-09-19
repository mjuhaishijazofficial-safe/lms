// Usage: node shot.mjs <admin|student|none> <path> <out.png> [width] [height]
// Logs in over HTTP, injects the session cookie into headless Edge via CDP, screenshots the page.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , who, path, out, w = "1440", h = "1000"] = process.argv;
const B = "http://localhost:3200";
const CREDS = { admin: ["admin@studyhub.local", process.env.SEED_ADMIN_PASSWORD], student: ["ali@studyhub.local", "Student-Demo-2026"] };
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&");

let sid;
if (who !== "none") {
  const home = await (await fetch(B + "/login")).text();
  const fd = new FormData();
  for (const m of home.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g)) fd.append(dec(m[1]), dec(m[2] ?? ""));
  fd.append("email", CREDS[who][0]); fd.append("password", CREDS[who][1]);
  const r = await fetch(B + "/login", { method: "POST", body: fd, redirect: "manual", headers: { origin: B } });
  sid = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("studyhub_session="))?.split("=")[1];
  if (!sid) throw new Error("login failed");
}

const port = 9300 + Math.floor(Math.random() * 500);
const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "edge-"))}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
    if (!target) await new Promise((r) => setTimeout(r, 250));
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else events.push(m); };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Page.enable");
  await send("Network.enable");
  if (sid) await send("Network.setCookie", { name: "studyhub_session", value: sid, domain: "localhost", path: "/", httpOnly: true });
  const mobile = Number(w) < 700;
  await send("Emulation.setDeviceMetricsOverride", { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile });
  await send("Page.navigate", { url: B + path });
  await new Promise((r) => setTimeout(r, 2500));
  if (process.argv[7]) { await send("Runtime.evaluate", { expression: process.argv[7], awaitPromise: true }); await new Promise((r) => setTimeout(r, 700)); }
  const layout = await send("Page.getLayoutMetrics");
  const full = Math.min(layout.result.cssContentSize?.height ?? Number(h), 4000);
  const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: Number(w), height: Math.max(Number(h), Math.ceil(full)), scale: 1 } });
  writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  const title = await send("Runtime.evaluate", { expression: "document.title + ' | overflowX=' + (document.documentElement.scrollWidth > innerWidth)" });
  console.log("saved", out, "|", title.result.result.value);
  ws.close();
} finally { edge.kill(); }
