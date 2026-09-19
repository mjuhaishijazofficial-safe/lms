import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { CourseForm } from "@/components/admin/course-form";

export const metadata: Metadata = { title: "New class" };

export default function NewCoursePage() {
  return (
    <>
      <PageHeader title="New class" crumbs={[{ label: "Classes", href: "/admin/courses" }, { label: "New class" }]} />
      <CourseForm />
    </>
  );
}
