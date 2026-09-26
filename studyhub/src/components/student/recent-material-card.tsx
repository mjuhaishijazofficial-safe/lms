import Link from "next/link";
import { describeMaterial, materialMeta } from "@/lib/material-types";
import { timeAgo } from "@/lib/format";
import { IconTile } from "@/components/ui/icon-tile";
import type { MaterialWithContext } from "@/server/services/library";
import { MaterialAction } from "./material-action";

export type RecentMaterial = MaterialWithContext;

/**
 * One row of a material list: title, type, subject, chapter, date added, action.
 * Rows have no box of their own — put them inside `<div className="card divide-y divide-line">`.
 */
export function RecentMaterialCard({ material: m, extra }: { material: RecentMaterial; extra?: React.ReactNode }) {
  const d = describeMaterial(m);
  const meta = materialMeta(m);
  return (
    <article className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <IconTile icon={d.icon} className={d.tile} />
      <div className="min-w-0 flex-1 basis-56">
        <Link href={`/materials/${m.id}`} prefetch={false} className="block truncate font-semibold hover:text-primary">{m.title}</Link>
        <p className="truncate text-sm text-muted">
          {d.label}{meta ? ` · ${meta}` : ""} · <Link href={`/subjects/${m.chapter.subject.id}`} className="hover:text-primary">{m.chapter.subject.name}</Link> · Chapter {m.chapter.chapterNumber}: {m.chapter.title}
        </p>
      </div>
      <p className="hidden w-28 text-right text-sm text-muted sm:block">{timeAgo(m.createdAt)}</p>
      <div className="flex items-center gap-2">
        <MaterialAction id={m.id} type={m.type} fileName={m.fileName} className="btn-soft btn-sm" />
        {extra}
      </div>
    </article>
  );
}
