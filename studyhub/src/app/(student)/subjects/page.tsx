import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { groupBySemester, loadLibrary } from "@/server/services/library";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SemesterGroup } from "@/components/student/semester-group";

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  const user = await requireStudent();
  const { courses, subjectCount } = await loadLibrary(user.id);
  const course = courses[0];
  const groups = groupBySemester(course?.subjects ?? [], course?.currentSemester?.id);

  return (
    <>
      <PageHeader title="Subjects" />
      {subjectCount === 0 ? (
        <div className="card">
          <EmptyState
            icon={Layers}
            title={courses.length === 0 ? `You haven't been assigned to a ${TERMS.programLower} yet.` : "No subjects have been added yet."}
            description={courses.length === 0 ? "Please contact your admin." : "Your subjects will appear here once your admin adds them."}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g, i) => <SemesterGroup key={g.key} group={g} defaultOpen={g.current || i === 0} />)}
        </div>
      )}
    </>
  );
}
