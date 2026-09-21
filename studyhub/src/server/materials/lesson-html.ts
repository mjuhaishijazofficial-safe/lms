import { OPTION_LETTERS, type Lesson } from "@/lib/lesson";
import { sanitizeLessonBody } from "./lesson-sanitize";

/**
 * Builds the self-contained .html file a student downloads. Everything is inline, so the file works offline
 * and needs no network at all. Content is written straight into the markup rather than into a script, so
 * there is no string that has to survive being parsed as JavaScript.
 */

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const STYLES = `
:root{--navy:#1e3a8a;--navy-dark:#172554;--gold:#c9a227;--ink:#0b1b3a;--muted:#5b6b85;
--page:#eef2f7;--card:#fff;--line:#d9e0ea;--soft:#e3e9f7;--teal:#0f766e;
font-family:"Segoe UI",system-ui,-apple-system,sans-serif;}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);line-height:1.55}
.hero{background:linear-gradient(120deg,var(--navy-dark),var(--navy));color:#fff;padding:36px 20px 28px;border-bottom:4px solid var(--gold)}
.wrap{max-width:900px;margin:0 auto;padding:0 18px}
.hero .wrap{padding:0}
.hero h1{margin:0 0 8px;font-size:clamp(1.4rem,4vw,2rem);font-weight:800;line-height:1.2}
.hero p{margin:0;opacity:.9;font-size:.98rem;max-width:680px}
.crumb{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);
padding:5px 13px;border-radius:999px;font-size:.78rem;margin-bottom:12px}
main{max-width:900px;margin:0 auto;padding:22px 18px 70px}
.tabbar{display:flex;gap:6px;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);
border-radius:16px;padding:8px;margin-bottom:20px}
.tab-btn{border:0;cursor:pointer;padding:9px 16px;border-radius:11px;font-weight:700;font-size:.87rem;
background:transparent;color:var(--navy);font-family:inherit}
.tab-btn[aria-selected="true"]{background:var(--navy);color:#fff}
.panel[hidden]{display:none}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;margin-bottom:12px;overflow:hidden}
.topic>summary{display:flex;align-items:center;gap:12px;padding:15px 17px;cursor:pointer;list-style:none;font-weight:700}
.topic>summary::-webkit-details-marker{display:none}
.topic>summary::after{content:"\\25be";margin-left:auto;color:var(--muted);transition:.2s}
.topic[open]>summary::after{transform:rotate(180deg)}
.ref{flex:none;min-width:34px;height:34px;padding:0 8px;border-radius:9px;background:var(--soft);color:var(--navy);
display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800}
.body{padding:0 17px 16px}
.body p{margin:0 0 10px;font-size:.94rem}
.body h4,.body h5{margin:14px 0 6px;font-size:.93rem;color:var(--navy)}
.body ul,.body ol{margin:0 0 10px;padding-left:20px}
.body li{margin-bottom:7px;font-size:.94rem}
.data-table{width:100%;border-collapse:collapse;margin:10px 0 14px;font-size:.84rem;display:block;overflow-x:auto}
.data-table th{background:var(--navy);color:#fff;text-align:left;padding:8px 10px}
.data-table td{padding:8px 10px;border-bottom:1px solid var(--line)}
.data-table tr:nth-child(even) td{background:#f7f9fc}
.example-box{background:#f7f9fc;border-left:4px solid var(--gold);border-radius:9px;padding:10px 12px;
margin:10px 0;font-size:.9rem;color:var(--muted);font-style:italic}
.flow-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0;font-size:.85rem}
.flow-box{background:var(--soft);border:1px solid var(--navy);color:var(--navy);border-radius:9px;padding:7px 11px;font-weight:700}
.step-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:10px 0}
.step-box{background:var(--navy);color:#fff;border-radius:11px;padding:12px;font-size:.85rem}
.step-box h4,.step-box h5{color:#fff;margin:0 0 5px}
.step-box p{color:#fff;margin:0;font-size:.83rem}
.def{padding:14px 16px}
.def-term{font-weight:800;color:var(--navy);margin-bottom:4px}
.def-text{font-size:.9rem;margin-bottom:8px}
.def-ex{font-size:.84rem;color:var(--muted);background:#f7f9fc;border-radius:8px;padding:8px 10px;font-style:italic}
.mcq{padding:17px}
.qnum{font-size:.74rem;font-weight:800;color:var(--navy);background:var(--soft);
display:inline-block;padding:3px 11px;border-radius:999px;margin-bottom:9px}
.q{font-size:.98rem;font-weight:700;margin:0 0 11px}
.opts{display:flex;flex-direction:column;gap:7px;margin-bottom:11px}
.opt{border:1px solid var(--line);border-radius:11px;padding:9px 11px;font-size:.9rem;display:flex;gap:10px;align-items:flex-start}
.opt-l{flex:none;width:23px;height:23px;border-radius:7px;background:var(--soft);color:var(--navy);
display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.75rem}
.opt.correct{background:#ecfdf5;border-color:var(--teal)}
.opt.correct .opt-l{background:var(--teal);color:#fff}
.ans{border-radius:11px;padding:10px 12px;font-size:.87rem;background:#ecfdf5;color:#065f46}
footer{text-align:center;color:var(--muted);font-size:.8rem;padding:10px 0 36px}
@media print{.tabbar{display:none}.panel[hidden]{display:block!important}.topic>summary::after{display:none}body{background:#fff}}
`;

const SCRIPT = `
document.querySelectorAll(".tab-btn").forEach(function(btn){
  btn.addEventListener("click", function(){
    document.querySelectorAll(".tab-btn").forEach(function(b){ b.setAttribute("aria-selected", String(b === btn)); });
    document.querySelectorAll(".panel").forEach(function(p){ p.hidden = p.id !== btn.getAttribute("aria-controls"); });
  });
});
`;

function topicsHtml(lesson: Lesson): string {
  return lesson.topics
    .map((t, i) => {
      // Re-sanitised on the way out: the file is opened outside the app, where nothing else can protect the reader.
      const body = sanitizeLessonBody(t.body);
      return `<details class="card topic"${i === 0 ? " open" : ""}>
<summary><span class="ref">${escape(t.ref ?? String(i + 1))}</span><span>${escape(t.title)}</span></summary>
<div class="body">${body}</div>
</details>`;
    })
    .join("\n");
}

function definitionsHtml(lesson: Lesson): string {
  return lesson.definitions
    .map(
      (d) => `<div class="card def">
<div class="def-term">${escape(d.term)}</div>
<div class="def-text">${escape(d.definition)}</div>
${d.example ? `<div class="def-ex">${escape(d.example)}</div>` : ""}
</div>`,
    )
    .join("\n");
}

function mcqsHtml(lesson: Lesson): string {
  return lesson.mcqs
    .map((m, i) => {
      const opts = m.options
        .map(
          (o, oi) =>
            `<div class="opt${oi === m.answer ? " correct" : ""}"><span class="opt-l">${OPTION_LETTERS[oi]}</span><span>${escape(o)}</span></div>`,
        )
        .join("");
      const answer = `<strong>Answer: ${OPTION_LETTERS[m.answer]}) ${escape(m.options[m.answer])}</strong>`;
      return `<div class="card mcq">
<span class="qnum">Question ${i + 1} of ${lesson.mcqs.length}</span>
<p class="q">${escape(m.question)}</p>
<div class="opts">${opts}</div>
<div class="ans">${answer}${m.explanation ? `<br>${escape(m.explanation)}` : ""}</div>
</div>`;
    })
    .join("\n");
}

/** The complete downloadable page for one lesson. */
export function lessonToHtml(lesson: Lesson, meta: { title: string; subject?: string; chapter?: string }): string {
  const panels: { id: string; label: string; content: string }[] = [];
  if (lesson.topics.length) panels.push({ id: "summary", label: "Summary", content: topicsHtml(lesson) });
  if (lesson.definitions.length) panels.push({ id: "definitions", label: "Definitions", content: definitionsHtml(lesson) });
  if (lesson.mcqs.length) panels.push({ id: "mcqs", label: `MCQs (${lesson.mcqs.length})`, content: mcqsHtml(lesson) });

  const crumb = [meta.subject, meta.chapter].filter(Boolean).join(" · ");
  const tabs = panels
    .map(
      (p, i) =>
        `<button class="tab-btn" role="tab" aria-selected="${i === 0}" aria-controls="${p.id}" id="tab-${p.id}">${escape(p.label)}</button>`,
    )
    .join("");
  const sections = panels
    .map((p, i) => `<section class="panel" id="${p.id}" role="tabpanel" aria-labelledby="tab-${p.id}"${i === 0 ? "" : " hidden"}>${p.content}</section>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(meta.title)}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="hero"><div class="wrap">
${crumb ? `<span class="crumb">${escape(crumb)}</span>` : ""}
<h1>${escape(meta.title)}</h1>
${lesson.subtitle ? `<p>${escape(lesson.subtitle)}</p>` : ""}
</div></div>
<main>
${panels.length > 1 ? `<div class="tabbar" role="tablist">${tabs}</div>` : ""}
${sections}
</main>
<footer>StudyHub · Keep this file, it works offline</footer>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
