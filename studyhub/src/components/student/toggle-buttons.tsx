import { Bookmark, BookmarkCheck, CircleCheck } from "lucide-react";
import { toggleCompletedAction, toggleMaterialBookmarkAction, toggleSubjectBookmarkAction } from "@/app/(student)/actions";

/** "Add to Bookmarks" / "Bookmarked", for the subject header. A plain form: works without JavaScript. */
export function SubjectBookmarkButton({ subjectId, bookmarked, returnTo }: { subjectId: string; bookmarked: boolean; returnTo: string }) {
  return (
    <form action={toggleSubjectBookmarkAction}>
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={bookmarked ? "btn-soft" : "btn-outline"} aria-pressed={bookmarked}>
        {bookmarked ? <BookmarkCheck className="size-4.5" aria-hidden /> : <Bookmark className="size-4.5" aria-hidden />}
        {bookmarked ? "Bookmarked" : "Add to Bookmarks"}
      </button>
    </form>
  );
}

/** Bookmark toggle for a single material, on its detail page. */
export function MaterialBookmarkButton({ materialId, bookmarked, returnTo }: { materialId: string; bookmarked: boolean; returnTo: string }) {
  return (
    <form action={toggleMaterialBookmarkAction}>
      <input type="hidden" name="materialId" value={materialId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={bookmarked ? "btn-soft" : "btn-outline"} aria-pressed={bookmarked}>
        {bookmarked ? <BookmarkCheck className="size-4.5" aria-hidden /> : <Bookmark className="size-4.5" aria-hidden />}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </button>
    </form>
  );
}

/** "Mark as complete" toggle on the material page. Chapter completion is derived from this, never set directly. */
export function MarkCompleteButton({ materialId, completed, returnTo }: { materialId: string; completed: boolean; returnTo: string }) {
  return (
    <form action={toggleCompletedAction}>
      <input type="hidden" name="materialId" value={materialId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={completed ? "btn-soft" : "btn-primary"} aria-pressed={completed}>
        <CircleCheck className="size-4.5" aria-hidden /> {completed ? "Completed" : "Mark as complete"}
      </button>
    </form>
  );
}

/** Small "Remove" link-button used on the Bookmarks page, reusing whichever toggle action applies. */
export function RemoveBookmarkButton({ kind, id, returnTo }: { kind: "subject" | "material"; id: string; returnTo: string }) {
  const action = kind === "subject" ? toggleSubjectBookmarkAction : toggleMaterialBookmarkAction;
  const field = kind === "subject" ? "subjectId" : "materialId";
  return (
    <form action={action}>
      <input type="hidden" name={field} value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className="btn-ghost text-red-600 hover:!bg-red-50">Remove bookmark</button>
    </form>
  );
}
