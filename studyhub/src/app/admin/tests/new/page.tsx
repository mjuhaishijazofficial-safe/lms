import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { chapterPickerTree } from "@/server/services/materials";
import { PageHeader } from "@/components/ui/page-header";
import { TestForm } from "@/components/admin/test-form";

export const metadata: Metadata = { title: "New test" };

export default async function NewTestPage() {
  const tree = await chapterPickerTree();
  if (tree.every((c) => c.subjects.length === 0)) redirect("/admin/tests");

  return (
    <>
      <PageHeader title="New test" crumbs={[{ label: "Tests", href: "/admin/tests" }, { label: "New test" }]} />
      <TestForm tree={tree} questions={[]} />
    </>
  );
}
