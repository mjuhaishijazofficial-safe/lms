import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { semesterTree } from "@/server/services/semesters";
import { getSubject, studentsTakingSubject, subjectOptions } from "@/server/services/subjects";
import { idSchema } from "@/server/validation/common";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { SubjectForm } from "@/components/admin/subject-form";
import { MergeSubject } from "@/components/admin/merge-subject";

export const metadata: Metadata = { title: "Edit subject" };

export default async function EditSubjectPage({ params, searchParams }: PageProps<"/admin/subjects/[id]">) {
  const { id } = await params;
  const valid = idSchema.safeParse(id).success;
  const [subject, tree, options, students] = await Promise.all([valid ? getSubject(id) : null, semesterTree(), subjectOptions(), valid ? studentsTakingSubject(id) : []]);
  if (!subject) notFound();

  return (
    <>
      <PageHeader
        title={subject.name}
        description={[subject.course.name, subject.semester?.name ?? `No ${TERMS.semesterLower} yet: choose one below`, plural(subject._count.chapters, "chapter")].join(" · ")}
        crumbs={[{ label: "Subjects", href: "/admin/subjects" }, { label: subject.name }]}
        actions={<Link href={`/admin/chapters?subject=${subject.id}`} className="btn-outline">Manage chapters</Link>}
      />
      <Notice searchParams={await searchParams} />
      <SubjectForm
        tree={tree}
        subject={{ id: subject.id, courseId: subject.courseId, semesterId: subject.semesterId ?? "", name: subject.name, description: subject.description, icon: subject.icon, status: subject.status }}
      />
      <div className="card mt-6 max-w-2xl space-y-3 p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Students taking this subject</h2>
        {students.length === 0 ? (
          <p className="text-sm text-muted">No student has this subject ticked yet. Students with no subjects ticked see every subject of their semester instead.</p>
        ) : (
          <>
            <p className="text-sm text-muted">{plural(students.length, "student")} have this subject ticked.</p>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {students.map((st) => (
                <li key={st.id}>
                  <Link href={`/admin/students/${st.id}`} className="block truncate rounded-lg px-2 py-1.5 text-sm hover:bg-page hover:text-primary">
                    {st.name}{st.status !== "ACTIVE" && <span className="ml-1.5 text-xs text-muted">(inactive)</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="mt-6">
        <MergeSubject subjectId={subject.id} subjectName={subject.name} options={options} />
      </div>
    </>
  );
}
