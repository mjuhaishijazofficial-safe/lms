import { BookOpen } from "lucide-react";
import { APP_TAGLINE } from "@/lib/constants";

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <BookOpen className="size-10 text-primary" strokeWidth={2.2} aria-hidden />
      <div className="leading-tight">
        <p className="text-2xl font-bold tracking-tight text-ink">
          Study<span className="text-primary">Hub</span>
        </p>
        <p className="text-xs text-ink/70">{APP_TAGLINE}</p>
      </div>
    </div>
  );
}
