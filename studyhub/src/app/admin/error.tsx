"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="We couldn't load this page. Your data is safe. Try again, and if it keeps happening let your developer know."
        action={<button onClick={reset} className="btn-primary">Try again</button>}
      />
    </div>
  );
}
