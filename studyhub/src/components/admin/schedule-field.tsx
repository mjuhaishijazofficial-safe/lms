"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Field, invalid } from "@/components/ui/field";

/** "YYYY-MM-DDTHH:mm" in the browser's own local time, for the <input type="datetime-local"> value. */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Lets the admin pick "publish automatically at this moment" in their own local time, but submits it as a full
 * ISO string (computed in the browser, where "local" correctly means the admin's own timezone) so the meaning
 * does not shift depending on which timezone the server happens to run in.
 *
 * A schedule only ever takes effect while Status is Draft, so the field only shows then — otherwise "publish
 * automatically on" sitting under an already-Published status reads as broken. The chosen time is kept in state
 * (and still submitted) even while hidden, so switching Status back to Draft brings it straight back.
 */
export function ScheduleField({ status, initial, error }: { status: string; initial?: string | null; error?: string[] }) {
  const [local, setLocal] = useState(() => (initial ? toLocalInputValue(initial) : ""));
  const iso = (() => {
    if (!local) return "";
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  })();

  if (status !== "DRAFT") return <input type="hidden" name="publishAt" value={iso} />;

  return (
    <Field
      id="publishAtLocal" label="Publish automatically on" error={error}
      hint="Leave blank to publish only when you switch this to Published yourself."
    >
      <div className="flex items-center gap-2">
        <input
          id="publishAtLocal" type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)}
          className={`input ${invalid(error)}`}
        />
        {local && (
          <button type="button" onClick={() => setLocal("")} className="btn-ghost !p-1.5" aria-label="Clear the scheduled time" title="Clear">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <input type="hidden" name="publishAt" value={iso} />
    </Field>
  );
}
