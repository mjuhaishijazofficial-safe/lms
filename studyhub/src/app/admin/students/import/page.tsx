import type { Metadata } from "next";
import { semesterTree } from "@/server/services/semesters";
import { PageHeader } from "@/components/ui/page-header";
import { StudentImportForm } from "@/components/admin/student-import-form";

export const metadata: Metadata = { title: "Import students" };

export default async function ImportStudentsPage() {
  const tree = await semesterTree();
  return (
    <>
      <PageHeader
        title="Import students"
        description="Add many students at once, with their subjects, from a pasted list."
        crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Import" }]}
      />
      <StudentImportForm tree={tree} />
    </>
  );
}
