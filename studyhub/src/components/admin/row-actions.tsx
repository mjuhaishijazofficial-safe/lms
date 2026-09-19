import Link from "next/link";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Eye, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Act = (formData: FormData) => void | Promise<void>;

export function MoveButtons({ id, action, returnTo, first, last, label }: {
  id: string; action: Act; returnTo: string; first?: boolean; last?: boolean; label: string;
}) {
  const btn = "btn-ghost !p-1.5";
  return (
    <div className="flex">
      {(["up", "down"] as const).map((dir) => (
        <form key={dir} action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value={dir} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className={btn} disabled={dir === "up" ? first : last} aria-label={`Move ${label} ${dir}`} title={`Move ${dir}`}>
            {dir === "up" ? <ChevronUp className="size-4.5" aria-hidden /> : <ChevronDown className="size-4.5" aria-hidden />}
          </button>
        </form>
      ))}
    </div>
  );
}

/** Edit / archive-or-publish / delete, shared by every content table. */
export function RowActions({ id, name, status, editHref, returnTo, setStatus, remove, deleteHint }: {
  id: string; name: string; status: string; editHref: string; returnTo: string;
  setStatus: Act; remove: Act; deleteHint: string;
}) {
  const publishing = status !== "PUBLISHED";
  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={editHref} className="btn-ghost" aria-label={`Edit ${name}`} title="Edit">
        <Pencil className="size-4" aria-hidden /> <span className="hidden 2xl:inline">Edit</span>
      </Link>
      <form action={setStatus}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={publishing ? "PUBLISHED" : "ARCHIVED"} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button className="btn-ghost" title={publishing ? (status === "ARCHIVED" ? "Restore" : "Publish") : "Archive"} aria-label={`${publishing ? (status === "ARCHIVED" ? "Restore" : "Publish") : "Archive"} ${name}`}>
          {publishing ? (status === "ARCHIVED" ? <ArchiveRestore className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />) : <Archive className="size-4" aria-hidden />}
          <span className="hidden 2xl:inline">{publishing ? (status === "ARCHIVED" ? "Restore" : "Publish") : "Archive"}</span>
        </button>
      </form>
      <ConfirmDialog
        trigger={<><Trash2 className="size-4" aria-hidden /> <span className="hidden 2xl:inline">Delete</span></>}
        triggerClassName="btn-ghost hover:!bg-red-50 hover:!text-red-600"
        triggerLabel={`Delete ${name}`}
        title={`Delete “${name}”?`}
        description={<>{deleteHint} This can&apos;t be undone.</>}
        confirmLabel="Delete"
        action={remove}
        fields={{ id, returnTo }}
      />
    </div>
  );
}
