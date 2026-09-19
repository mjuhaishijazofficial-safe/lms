import Link from "next/link";
import { describeMaterial, materialMeta } from "@/lib/material-types";
import { timeAgo } from "@/lib/format";
import { IconTile } from "@/components/ui/icon-tile";
import type { MaterialWithContext } from "@/server/services/library";
import { MaterialAction } from "./material-action";

export type RecentMaterial = MaterialWithContext;

/** One row of the recent-materials list: title, type, subject, chapter, date added, action. */
export function RecentMaterialCard({ material: m }: { material: RecentMaterial }) {
  const d = describeMaterial(m);
  const meta = materialMeta(m);
  return (
    <article className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <IconTile icon={d.icon} className={d.tile} />
      <div className="min-w-0 flex-1 basis-56">
        <Link href={`/materials/${m.id}`} prefetch={false} className="block truncate font-semibold hover:text-primary">{m.title}</Link>
        <p className="truncate text-sm text-muted">
          {d.label}{meta ? ` · ${meta}` : ""} · <Link href={`/subjects/${m.chapter.subject.id}`} className="hover:text-primary">{m.chapter.subject.name}</Link> · Chapter {m.chapter.chapterNumber}: {m.chapter.title}
        </p>
      </div>
      <p className="text-sm text-muted">Added {timeAgo(m.createdAt)}</p>
      <MaterialAction id={m.id} type={m.type} className="btn-soft !px-4 !py-2" />
    </article>
  );
}
