"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { timeAgo } from "@/lib/format";

export type NotificationItem = { id: string; title: string; subject: string; createdAt: string };

/** The bell: study material added in the last week. Real data, not a decoration. */
export function NotificationsMenu({ count, items }: { count: number; items: NotificationItem[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false; };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={count ? `${count} new study materials this week` : "No new study materials this week"}
        className="relative flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-ink/80 transition hover:bg-surface [&::-webkit-details-marker]:hidden"
      >
        <Bell className="size-6" aria-hidden />
        {count > 0 && (
          <span className="absolute right-1 top-1 inline-flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-4.5 text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </summary>
      <div className="card absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] p-2">
        <p className="px-3 py-2 text-sm font-semibold">Added this week</p>
        {items.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted">No new study material this week.</p>
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <Link href={`/materials/${n.id}`} className="block rounded-lg px-3 py-2 hover:bg-page">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  <span className="block truncate text-xs text-muted">{n.subject} · {timeAgo(n.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/recent" className="mt-1 block rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-page">See all recent materials</Link>
      </div>
    </details>
  );
}
