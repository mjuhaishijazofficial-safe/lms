import { arrayNames } from "./html-mcq-import";

/**
 * Browser only. Runs a study-guide HTML file inside a sandboxed, invisible iframe and returns the lists its scripts
 * declared (see html-mcq-import.ts). The sandbox has no same-origin access, so the file's scripts cannot touch
 * StudyHub's page, cookies or storage; they only get to build their own page, after which one extra script reports
 * the lists back by postMessage.
 */

export class HtmlReadError extends Error {}

const TOKEN = "__studyhub_html_import__";

function reporter(names: string[]): string {
  // Reads each declared list by name (top-level `const` is visible to later scripts), copying it as plain JSON.
  return `<script>(function(){var names=${JSON.stringify(names)};var out={};for(var i=0;i<names.length;i++){try{var v=eval(names[i]);if(Array.isArray(v))out[names[i]]=JSON.parse(JSON.stringify(v));}catch(e){}}parent.postMessage({${TOKEN}:true,arrays:out},"*");})();<\/script>`;
}

export async function readHtmlArrays(file: File, timeoutMs = 10_000): Promise<Record<string, unknown>> {
  if (file.size > 5 * 1_048_576) throw new HtmlReadError("This HTML file is larger than 5 MB, which is more than a study guide should be.");
  const source = await file.text();
  if (!/<script/i.test(source)) throw new HtmlReadError("This doesn't look like an HTML study guide: it has no question list inside.");
  const names = arrayNames(source);
  if (names.length === 0) throw new HtmlReadError("No question list was found in this file.");

  const html = /<\/body>/i.test(source) ? source.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${reporter(names)}</body>`) : source + reporter(names);

  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0;visibility:hidden";
    const done = () => { window.removeEventListener("message", onMessage); clearTimeout(timer); frame.remove(); };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !e.data || e.data[TOKEN] !== true) return;
      done();
      resolve((e.data.arrays ?? {}) as Record<string, unknown>);
    };
    const timer = setTimeout(() => { done(); reject(new HtmlReadError("This file took too long to open. Try it again, or check it opens in your browser.")); }, timeoutMs);
    window.addEventListener("message", onMessage);
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
