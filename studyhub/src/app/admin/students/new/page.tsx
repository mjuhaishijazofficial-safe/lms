import type { Metadata } from "next";
import { semesterTree } from "@/server/services/semesters";
import { PageHeader } from "@/components/ui/page-header";
import { StudentForm } from "@/components/admin/student-form";

export const metadata: Metadata = { title: "New student" };

export default async function NewStudentPage() {
  const tree = await semesterTree();
  return (
    <>
      <PageHeader title="New student" crumbs={[{ label: "Students", href: "/admin/students" }, { label: "New student" }]} />
      <StudentForm tree={tree} />
    </>
  );
}
