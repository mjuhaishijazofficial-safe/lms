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
        description="Drop in a folder's worth of files — each one becomes its own material in the chapter you choose."
        crumbs={[{ label: "Materials", href: "/admin/materials" }, { label: "Add multiple" }]}
      />
      <BulkUpload tree={tree} maxMb={env.MAX_UPLOAD_MB} />
    </>
  );
}
