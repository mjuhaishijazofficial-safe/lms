/**
 * A reasonable material title guessed from a file name: the extension is dropped, underscores and dashes become
 * spaces, and the first letter is capitalised. Only ever a starting point — the admin can edit it before uploading.
 */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, "");
  const spaced = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return "Untitled";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
