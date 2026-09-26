import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/server/env";
import { chapterPickerTree } from "@/server/services/materials";
import { PageHeader } from "@/components/ui/page-header";
import { BulkUpload } from "@/components/admin/bulk-upload";

export const metadata: Metadata = { title: "Add multiple materials" };

export default async function BulkMaterialsPage() {
  const tree = await chapterPickerTree();
  if (!tree.some((c) => c.subjects.some((s) => s.chapters.length))) redirect("/admin/materials");

  return (
    <>
      <PageHeader
        title="Add multiple materials"
        crumbs={[{ label: "Materials", href: "/admin/materials" }, { label: "Add multiple" }]}
      />
      <BulkUpload tree={tree} maxMb={env.MAX_UPLOAD_MB} />
    </>
  );
}
