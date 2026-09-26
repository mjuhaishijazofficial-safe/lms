import { BookOpen } from "lucide-react";
import { APP_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/format";

/** `tone="dark"` is for the navy sidebar; the default suits light backgrounds. */
export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div className="flex items-center gap-3">
      <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-control", dark ? "bg-primary text-white" : "bg-primary-soft text-primary")}>
        <BookOpen className="size-5.5" strokeWidth={2.2} aria-hidden />
      </span>
      <div className="leading-tight">
        <p className={cn("text-xl font-bold tracking-tight", dark ? "text-white" : "text-ink")}>
          Study<span className={dark ? "text-sidebar-accent" : "text-primary"}>Hub</span>
        </p>
        <p className={cn("text-xs", dark ? "text-sidebar-ink" : "text-muted")}>{APP_TAGLINE}</p>
      </div>
    </div>
  );
}
