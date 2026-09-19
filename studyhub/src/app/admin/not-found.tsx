import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminNotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={SearchX}
        title="We couldn't find that"
        description="It may have been deleted, or the link is wrong."
        action={<Link href="/admin" className="btn-primary">Back to dashboard</Link>}
      />
    </div>
  );
}
