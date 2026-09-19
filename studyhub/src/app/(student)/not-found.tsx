import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// One message for "doesn't exist" and "not yours": students can't tell the two apart, which keeps other programs' and later semesters' content private.
export default function StudentNotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={LockKeyhole}
        title="We couldn't open that"
        description="It may have been removed, or you don't have permission to access it."
        action={<Link href="/dashboard" className="btn-primary">Back to dashboard</Link>}
      />
    </div>
  );
}
