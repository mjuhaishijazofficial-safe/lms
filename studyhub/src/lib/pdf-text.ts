// Reads the text of a PDF in the browser, so a 40 MB handout never has to be uploaded: only its text is sent on.
// pdfjs is loaded on demand, so it does not weigh down any other page.

/** The parts of a pdfjs text item that matter here (kept minimal so the logic below can be tested without pdfjs). */
export type TextItem = { str: string; transform: number[]; hasEOL?: boolean };

/**
 * Puts positioned pieces of text back into lines: a new line starts when the item says so or when the vertical
 * position jumps. Pieces on the same line are joined with a space when neither side already has one.
 */
export function pageTextFromItems(items: TextItem[]): string {
  let out = "";
  let lastY: number | null = null;
  for (const it of items) {
    const y = it.transform[5];
    // An item that ended its line has already started the next one: a second newline would leave a blank line.
    if (lastY !== null && Math.abs(y - lastY) > 2) out += out.endsWith("\n") ? "" : "\n";
    else if (out && lastY !== null && !out.endsWith(" ") && !out.endsWith("\n") && !it.str.startsWith(" ")) out += " ";
    out += it.str;
    if (it.hasEOL) out += "\n";
    lastY = y;
  }
  return out;
}

export class PdfReadError extends Error {}

/** Extracts the text of every page. Reports progress so a long handout does not look frozen. */
export async function extractPdfPages(file: File, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (err) {
    await task.destroy().catch(() => undefined);
    const name = err instanceof Error ? err.name : "";
    if (name === "PasswordException") throw new PdfReadError("This PDF is password protected. Remove the password and try again.");
    throw new PdfReadError("This file could not be read as a PDF. Check that it is not damaged.");
  }

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(pageTextFromItems(content.items.filter((it): it is Extract<typeof it, { str: string }> => "str" in it)));
    page.cleanup();
    onProgress?.(i, pdf.numPages);
  }
  await task.destroy();

  // A scanned handout is only pictures: there is no text to read, and the AI would be sent nothing.
  if (pages.join("").replace(/\s+/g, "").length < 200) {
    throw new PdfReadError("This PDF has almost no text. It may be scanned pictures of pages, which this tool cannot read.");
  }
  return pages;
}
