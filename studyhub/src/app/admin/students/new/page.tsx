import type { Metadata } from "next";
import { semesterTree } from "@/server/services/semesters";
import { subjectCatalogue } from "@/server/services/subjects";
import { studentPresets } from "@/server/services/students";
import { PageHeader } from "@/components/ui/page-header";
import { StudentForm } from "@/components/admin/student-form";

export const metadata: Metadata = { title: "New student" };

export default async function NewStudentPage() {
  const [tree, catalogue, presets] = await Promise.all([semesterTree(), subjectCatalogue(), studentPresets()]);
  return (
    <>
      <PageHeader title="New student" crumbs={[{ label: "Students", href: "/admin/students" }, { label: "New student" }]} />
      <StudentForm tree={tree} catalogue={catalogue} presets={presets} />
    </>
  );
}
