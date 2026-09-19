// Learning progress. Pure functions so the rules are easy to test and reuse.
//
// A chapter counts as complete when it has at least one published material and the student has
// completed every one of them. Chapters with no material can't be completed, so they are left out
// of the totals ("3 / 12 chapters" only counts chapters that have something to study).

export type ChapterMaterials = { id: string; materialIds: readonly string[] };
export type Progress = { completedChapters: number; totalChapters: number; percent: number };

export const isChapterComplete = (chapter: ChapterMaterials, completed: ReadonlySet<string>) =>
  chapter.materialIds.length > 0 && chapter.materialIds.every((id) => completed.has(id));

export function computeProgress(chapters: readonly ChapterMaterials[], completed: ReadonlySet<string>): Progress {
  const counted = chapters.filter((c) => c.materialIds.length > 0);
  const done = counted.filter((c) => isChapterComplete(c, completed)).length;
  return { completedChapters: done, totalChapters: counted.length, percent: counted.length ? Math.round((100 * done) / counted.length) : 0 };
}
