import type { Metadata } from "next";
import { courseOptions } from "@/server/services/courses";
import { PageHeader } from "@/components/ui/page-header";
import { FeeBulkForm } from "@/components/admin/fee-bulk-form";

export const metadata: Metadata = { title: "New fee" };

export default async function NewFeePage() {
  const courses = await courseOptions();
  return (
    <>
      <PageHeader title="New fee" crumbs={[{ label: "Fees", href: "/admin/fees" }, { label: "New fee" }]} />
      <FeeBulkForm courses={courses} />
    </>
  );
}
