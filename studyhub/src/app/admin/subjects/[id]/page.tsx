import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { semesterTree } from "@/server/services/semesters";
import { getSubject } from "@/server/services/subjects";
import { idSchema } from "@/server/validation/common";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { SubjectForm } from "@/components/admin/subject-form";

export const metadata: Metadata = { title: "Edit subject" };

export default async function EditSubjectPage({ params, searchParams }: PageProps<"/admin/subjects/[id]">) {
  const { id } = await params;
  const [subject, tree] = await Promise.all([idSchema.safeParse(id).success ? getSubject(id) : null, semesterTree()]);
  if (!subject) notFound();

  return (
    <>
      <PageHeader
        title={subject.name}
        description={[subject.course.name, subject.semester?.name ?? `Every ${TERMS.semesterLower}`, plural(subject._count.chapters, "chapter")].join(" · ")}
        crumbs={[{ label: "Subjects", href: "/admin/subjects" }, { label: subject.name }]}
        actions={<Link href={`/admin/chapters?subject=${subject.id}`} className="btn-outline">Manage chapters</Link>}
      />
      <Notice searchParams={await searchParams} />
      <SubjectForm
        tree={tree}
        subject={{ id: subject.id, courseId: subject.courseId, semesterId: subject.semesterId ?? "", name: subject.name, description: subject.description, icon: subject.icon, status: subject.status }}
      />
    </>
  );
}
