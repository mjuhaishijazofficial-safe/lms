"use client";

import { useId, useRef } from "react";
import { TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/format";
import { SubmitButton } from "./submit-button";

/**
 * A trigger button that opens a native <dialog>; confirming submits `action` with the hidden `fields`.
 * The server action still re-checks permissions — this only prevents accidental clicks.
 */
export function ConfirmDialog({ trigger, triggerClassName, triggerLabel, title, description, confirmLabel, action, fields, tone = "danger" }: {
  trigger: React.ReactNode;
  triggerClassName?: string;
  /** Accessible name when the trigger is icon-only. */
  triggerLabel?: string;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  tone?: "danger" | "primary";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button type="button" className={triggerClassName ?? "btn-ghost"} aria-label={triggerLabel} title={triggerLabel} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full", tone === "danger" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary")}>
              <TriangleAlert className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
              <div className="mt-1 text-sm text-muted">{description}</div>
            </div>
            <button type="button" onClick={() => ref.current?.close()} className="btn-icon btn-sm -mr-1 -mt-1" aria-label="Close">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <form action={action} className="mt-6 flex justify-end gap-3">
            {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <button type="button" className="btn-outline" onClick={() => ref.current?.close()}>Cancel</button>
            <SubmitButton variant={tone === "danger" ? "danger" : "primary"}>{confirmLabel}</SubmitButton>
          </form>
        </div>
      </dialog>
    </>
  );
}
