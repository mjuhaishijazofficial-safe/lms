import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/server/env";
import { chapterPickerTree } from "@/server/services/materials";
import { idParam } from "@/lib/params";
import { PageHeader } from "@/components/ui/page-header";
import { MaterialForm } from "@/components/admin/material-form";

export const metadata: Metadata = { title: "New material" };

export default async function NewMaterialPage({ searchParams }: PageProps<"/admin/materials/new">) {
  const tree = await chapterPickerTree();
  if (!tree.some((c) => c.subjects.some((s) => s.chapters.length))) redirect("/admin/materials");

  return (
    <>
      <PageHeader title="New material" crumbs={[{ label: "Materials", href: "/admin/materials" }, { label: "New material" }]} />
      <MaterialForm tree={tree} defaultChapterId={idParam(await searchParams, "chapter")} maxMb={env.MAX_UPLOAD_MB} />
    </>
  );
}
