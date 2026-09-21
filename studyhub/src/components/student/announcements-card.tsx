import { Megaphone } from "lucide-react";
import { timeAgo } from "@/lib/format";

export type AnnouncementItem = { id: string; title: string; body: string; createdAt: Date };

/** Messages from the admins, shown above everything else on the dashboard. Renders nothing when there are none. */
export function AnnouncementsCard({ items }: { items: AnnouncementItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Announcements" className="mb-8 rounded-card border border-accent/40 bg-accent/10 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <Megaphone className="size-5 text-primary" aria-hidden /> Announcements
      </h2>
      <ul className="mt-3 divide-y divide-accent/25">
        {items.map((a) => (
          <li key={a.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-ink/85">{a.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
