import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { listCourses } from "@/server/services/courses";
import { plural } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableCard, Td, Th, Tr } from "@/components/ui/data-table";
import { MoveButtons, RowActions } from "@/components/admin/row-actions";
import { deleteCourseAction, moveCourseAction, setCourseStatusAction } from "./actions";

export const metadata: Metadata = { title: "Classes" };

export default async function CoursesPage({ searchParams }: PageProps<"/admin/courses">) {
  const courses = await listCourses();
  const returnTo = "/admin/courses";

  return (
    <>
      <PageHeader
        title="Classes"
        description="Classes or courses group subjects and students, for example Class 10 or FSC."
        actions={<Link href="/admin/courses/new" className="btn-primary"><Plus className="size-4.5" aria-hidden /> New class</Link>}
      />
      <Notice searchParams={await searchParams} />

      {courses.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={GraduationCap}
            title="No classes have been added yet."
            description="Create a class first, then add its subjects and enrol students."
            action={<Link href="/admin/courses/new" className="btn-primary">Create your first class</Link>}
          />
        </div>
      ) : (
        <TableCard>
          <Table caption="Classes">
            <thead>
              <tr><Th className="hidden md:table-cell">Order</Th><Th>Class</Th><Th className="hidden md:table-cell">Subjects</Th><Th className="hidden md:table-cell">Students</Th><Th>Status</Th><Th><span className="sr-only">Actions</span></Th></tr>
            </thead>
            <tbody>
              {courses.map((c, i) => (
                <Tr key={c.id}>
                  <Td className="hidden md:table-cell"><MoveButtons id={c.id} action={moveCourseAction} returnTo={returnTo} first={i === 0} last={i === courses.length - 1} label={c.name} /></Td>
                  <Td>
                    <Link href={`/admin/courses/${c.id}`} className="font-semibold hover:text-primary">{c.name}</Link>
                    {c.description && <p className="mt-0.5 line-clamp-1 max-w-md text-muted">{c.description}</p>}
                  </Td>
                  <Td className="hidden whitespace-nowrap md:table-cell"><Link href={`/admin/subjects?course=${c.id}`} className="text-primary hover:underline">{plural(c._count.subjects, "subject")}</Link></Td>
                  <Td className="hidden whitespace-nowrap md:table-cell"><Link href={`/admin/students?course=${c.id}`} className="text-primary hover:underline">{plural(c._count.enrollments, "student")}</Link></Td>
                  <Td><StatusBadge status={c.status} /></Td>
                  <Td>
                    <RowActions
                      id={c.id} name={c.name} status={c.status} editHref={`/admin/courses/${c.id}`} returnTo={returnTo}
                      setStatus={setCourseStatusAction} remove={deleteCourseAction}
                      deleteHint="Only classes with no subjects and no students can be deleted."
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableCard>
      )}
    </>
  );
}
