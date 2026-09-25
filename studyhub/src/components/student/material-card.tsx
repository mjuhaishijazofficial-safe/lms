import Link from "next/link";
import { CircleCheck } from "lucide-react";
import type { MaterialCardData } from "@/server/services/library";
import { describeMaterial, materialMeta } from "@/lib/material-types";
import { IconTile } from "@/components/ui/icon-tile";
import { MaterialAction } from "./material-action";

/** A material as a card: icon, title, description, size or duration, and its action button. */
export function MaterialCard({ material: m, completed, context }: { material: MaterialCardData; completed?: boolean; context?: string }) {
  const d = describeMaterial(m);
  const meta = [d.label, materialMeta(m)].filter(Boolean).join(" · ");
  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex gap-3.5">
        <IconTile icon={d.icon} className={d.tile} />
        <div className="min-w-0 flex-1">
          <Link href={`/materials/${m.id}`} prefetch={false} className="line-clamp-2 font-semibold leading-snug hover:text-primary">{m.title}</Link>
          {m.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{m.description}</p>}
          <p className="mt-1.5 text-sm text-muted">{meta}</p>
          {context && <p className="mt-0.5 truncate text-xs text-muted">{context}</p>}
        </div>
        {completed && <CircleCheck className="size-5 shrink-0 text-emerald-600" aria-label="Completed" />}
      </div>
      <div className="mt-auto pt-4">
        <MaterialAction id={m.id} type={m.type} fileName={m.fileName} className="btn-soft w-full" />
      </div>
    </article>
  );
}

export function MaterialGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
