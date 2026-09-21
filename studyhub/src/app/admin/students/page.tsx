import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardPaste, Pencil, Plus, UserRoundCheck, UserRoundX, Users } from "lucide-react";
import { courseOptions } from "@/server/services/courses";
import { semesterTree } from "@/server/services/semesters";
import { TERMS } from "@/lib/terms";
import { listStudents } from "@/server/services/students";
import { PAGE_SIZE } from "@/server/services/_shared";
import { idParam, one, pageParam } from "@/lib/params";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableCard, Td, Th, Tr } from "@/components/ui/data-table";
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { setStudentStatusAction } from "./actions";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const sp = await searchParams;
  const q = one(sp, "q");
  const courseRaw = one(sp, "course");
  const courseId = courseRaw === "none" ? "none" : idParam(sp, "course");
  const semesterId = idParam(sp, "semester");
  const statusRaw = one(sp, "status");
  const status = statusRaw === "ACTIVE" || statusRaw === "INACTIVE" ? statusRaw : undefined;
  const page = pageParam(sp);

  const [courses, tree, { rows, total }] = await Promise.all([courseOptions(), semesterTree(), listStudents({ q, courseId, semesterId, status, page })]);
  const filtered = !!(q || courseId || semesterId || status);
  const params = { q, course: courseId, semester: semesterId, status };
  const returnTo = "/admin/students" + (page > 1 ? `?page=${page}` : "");

  return (
    <>
      <PageHeader
        title="Students"
        description={`Create student accounts, place them in a ${TERMS.programLower} and ${TERMS.semesterLower}, and control who can sign in.`}
        actions={
          <>
            <Link href="/admin/students/import" className="btn-outline"><ClipboardPaste className="size-4.5" aria-hidden /> Import list</Link>
            <Link href="/admin/students/new" className="btn-primary"><Plus className="size-4.5" aria-hidden /> New student</Link>
          </>
        }
      />
      <Notice searchParams={sp} />

      <FilterBar basePath="/admin/students" q={q} placeholder="Search by name, email or student ID…" active={filtered}>
        <FilterSelect name="course" label={TERMS.program} value={courseId}>
          <option value="">All {TERMS.programs.toLowerCase()}</option>
          <option value="none">Not assigned</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FilterSelect>
        <FilterSelect name="semester" label={TERMS.semester} value={semesterId}>
          <option value="">Any {TERMS.semesterLower}</option>
          {tree.filter((c) => c.semesters.length).map((c) => (
            <optgroup key={c.id} label={c.name}>{c.semesters.map((sem) => <option key={sem.id} value={sem.id}>{sem.name}</option>)}</optgroup>
          ))}
        </FilterSelect>
        <FilterSelect name="status" label="Status" value={status}>
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </FilterSelect>
      </FilterBar>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={filtered ? "No students match your filters." : "No students have been added yet."}
            description={filtered ? "Try a different search or clear the filters." : "Add a student so they can sign in and see their study material."}
            action={!filtered && <Link href="/admin/students/new" className="btn-primary">Add your first student</Link>}
          />
        </div>
      ) : (
        <TableCard footer={<Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/students" params={params} />}>
          <Table caption="Students" className="md:min-w-160">
            <thead>
              <tr><Th>Student</Th><Th className="hidden md:table-cell">Student ID</Th><Th className="hidden md:table-cell">{TERMS.program}</Th><Th>Status</Th><Th className="hidden md:table-cell">Last sign-in</Th><Th><span className="sr-only">Actions</span></Th></tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const active = s.status === "ACTIVE";
                return (
                  <Tr key={s.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} />
                        <div className="min-w-0">
                          <Link href={`/admin/students/${s.id}`} className="font-semibold hover:text-primary">{s.name}</Link>
                          <p className="truncate text-muted">{s.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden text-muted md:table-cell">{s.studentProfile?.studentId ?? "—"}</Td>
                    <Td className="hidden whitespace-nowrap md:table-cell">
                      {s.enrollments[0] ? (
                        <>
                          <p>{s.enrollments[0].course.name}</p>
                          <p className="text-muted">{s.enrollments[0].semester?.name ?? `No ${TERMS.semesterLower} set`}</p>
                        </>
                      ) : <span className="text-muted">Not assigned</span>}
                    </Td>
                    <Td>
                      <StatusBadge status={s.status} />
                      {s.mustChangePassword && <p className="mt-1 text-xs text-amber-700">Password change pending</p>}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted md:table-cell">{s.lastLoginAt ? timeAgo(s.lastLoginAt) : "Never"}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/students/${s.id}`} className="btn-ghost" aria-label={`Edit ${s.name}`}><Pencil className="size-4" aria-hidden /> <span className="hidden 2xl:inline">Edit</span></Link>
                        <form action={setStudentStatusAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button className="btn-ghost" title={active ? "Deactivate" : "Reactivate"} aria-label={`${active ? "Deactivate" : "Reactivate"} ${s.name}`}>
                            {active ? <UserRoundX className="size-4" aria-hidden /> : <UserRoundCheck className="size-4" aria-hidden />}
                            <span className="hidden 2xl:inline">{active ? "Deactivate" : "Reactivate"}</span>
                          </button>
                        </form>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableCard>
      )}
    </>
  );
}
