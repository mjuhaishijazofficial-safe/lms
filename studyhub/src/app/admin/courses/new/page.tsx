import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { CourseForm } from "@/components/admin/course-form";

export const metadata: Metadata = { title: `New ${TERMS.programLower}` };

export default function NewCoursePage() {
  return (
    <>
      <PageHeader
        title={`New ${TERMS.programLower}`}
        crumbs={[{ label: TERMS.programs, href: "/admin/courses" }, { label: `New ${TERMS.programLower}` }]}
        actions={<Link href="/admin/courses/vu" className="btn-outline"><Download className="size-4.5" aria-hidden /> Pick a VU degree instead</Link>}
      />
      <CourseForm />
    </>
  );
}
