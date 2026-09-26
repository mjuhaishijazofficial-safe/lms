import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Trash2, Wallet } from "lucide-react";
import { courseOptions } from "@/server/services/courses";
import { listFees } from "@/server/services/fees";
import { PAGE_SIZE } from "@/server/services/_shared";
import { idParam, one, pageParam } from "@/lib/params";
import { formatAmount } from "@/lib/fees";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableCard, Td, Th, Tr } from "@/components/ui/data-table";
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { FeeStatusSelect } from "@/components/admin/fee-status-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteFeeAction } from "./actions";
import { TERMS } from "@/lib/terms";

export const metadata: Metadata = { title: "Fees" };

export default async function FeesPage({ searchParams }: PageProps<"/admin/fees">) {
  const sp = await searchParams;
  const courseId = idParam(sp, "course");
  const q = one(sp, "q");
  const statusRaw = one(sp, "status");
  const status = statusRaw === "PENDING" || statusRaw === "PAID" || statusRaw === "WAIVED" ? statusRaw : undefined;
  const page = pageParam(sp);

  const [courses, { items, total }] = await Promise.all([courseOptions(), listFees({ courseId, status, q, page })]);
  const filtered = !!(courseId || status || q);
  const params = { course: courseId, status, q };
  const returnTo = "/admin/fees";

  return (
    <>
      <PageHeader
        title="Fees"
        description="What each student owes StudyHub for a period, and whether they've paid. Payment itself happens off-platform — this is only the record."
        actions={<Link href="/admin/fees/new" className="btn-primary"><Plus className="size-4.5" aria-hidden /> New fee</Link>}
      />
      <Notice searchParams={sp} />

      <FilterBar basePath="/admin/fees" q={q} placeholder="Search by student name…" active={filtered}>
        <FilterSelect name="course" label={TERMS.program} value={courseId}>
          <option value="">All {TERMS.programs.toLowerCase()}</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FilterSelect>
        <FilterSelect name="status" label="Status" value={status}>
          <option value="">Any status</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="WAIVED">Waived</option>
        </FilterSelect>
      </FilterBar>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Wallet} title={filtered ? "No fees match your filters." : "No fees yet."}
            description={filtered ? "Try a different search or clear the filters." : "Generate a fee for one program or every student, or add one from a student's profile."}
            action={!filtered && <Link href="/admin/fees/new" className="btn-primary">Create your first fee</Link>} />
        </div>
      ) : (
        <TableCard footer={<Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/fees" params={params} />}>
          <Table caption="Fees">
            <thead>
              <tr>
                <Th>Student</Th>
                <Th className="hidden md:table-cell">Period</Th>
                <Th>Amount</Th>
                <Th className="hidden md:table-cell">Due</Th>
                <Th>Status</Th>
                <Th><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <Tr key={f.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={f.user.name} size="sm" />
                      <div className="min-w-0">
                        <Link href={`/admin/students/${f.user.id}`} className="truncate font-medium hover:text-primary">{f.user.name}</Link>
                        <p className="truncate text-muted">{f.user.enrollments[0]?.course.name ?? f.user.email}</p>
                        <p className="mt-0.5 text-muted md:hidden">{f.period}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">{f.period}</Td>
                  <Td className="whitespace-nowrap">{formatAmount(f.amount)}</Td>
                  <Td className="hidden whitespace-nowrap text-muted md:table-cell">{f.dueDate ? formatDate(f.dueDate) : "—"}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <FeeStatusSelect id={f.id} status={f.status} returnTo={returnTo} />
                    </div>
                  </Td>
                  <Td>
                    <ConfirmDialog
                      trigger={<Trash2 aria-hidden />}
                      triggerClassName="btn-icon-danger btn-sm"
                      triggerLabel={`Delete this fee for ${f.user.name}`}
                      title={`Delete this fee for ${f.user.name}?`}
                      description="This can't be undone."
                      confirmLabel="Delete"
                      action={deleteFeeAction}
                      fields={{ id: f.id, returnTo }}
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
