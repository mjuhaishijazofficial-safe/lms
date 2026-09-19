import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { semesterTree } from "@/server/services/semesters";
import { db } from "@/server/db";
import { idParam } from "@/lib/params";
import { PageHeader } from "@/components/ui/page-header";
import { SubjectForm } from "@/components/admin/subject-form";

export const metadata: Metadata = { title: "New subject" };

export default async function NewSubjectPage({ searchParams }: PageProps<"/admin/subjects/new">) {
  const tree = await semesterTree();
  if (tree.length === 0) redirect("/admin/subjects");
  const sp = await searchParams;
  const semesterId = idParam(sp, "semester");
  // A semester in the link also tells us its program; otherwise use ?course=.
  const semester = semesterId ? await db.semester.findUnique({ where: { id: semesterId }, select: { id: true, courseId: true } }) : null;
  const courseId = semester?.courseId ?? idParam(sp, "course");

  return (
    <>
      <PageHeader title="New subject" crumbs={[{ label: "Subjects", href: "/admin/subjects" }, { label: "New subject" }]} />
      <SubjectForm tree={tree} defaultCourseId={courseId} defaultSemesterId={semester?.id} />
    </>
  );
}
