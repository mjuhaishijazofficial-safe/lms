"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * A "⋯" button that opens a small panel of actions. Closes on Escape or a click outside. The panel stays mounted
 * while closed (only hidden) so a confirm dialog opened from inside it survives the menu closing.
 */
export function Menu({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      // Clicks inside an open <dialog> belong to it, not to "outside".
      const t = e.target as Node;
      if (root.current?.contains(t) || (t instanceof Element && t.closest("dialog[open]"))) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <button type="button" className="btn-icon" aria-label={label} title={label} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      <div id={panelId} hidden={!open} className="absolute right-0 top-full z-20 mt-1 w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl">
        {children}
      </div>
    </div>
  );
}