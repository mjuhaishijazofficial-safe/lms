import type { Metadata } from "next";
import { UserRoundCheck, UserRoundX } from "lucide-react";
import { assertAdmin } from "@/server/auth/guards";
import { listAdmins } from "@/server/services/admins";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableCard, Td, Th, Tr } from "@/components/ui/data-table";
import { AdminForm, ResetAdminPasswordForm } from "@/components/admin/admin-form";
import { setAdminStatusAction } from "./actions";

export const metadata: Metadata = { title: "Admins" };

export default async function AdminsPage({ searchParams }: PageProps<"/admin/admins">) {
  const sp = await searchParams;
  const me = await assertAdmin();
  const admins = await listAdmins(me);

  return (
    <>
      <PageHeader title="Admins" />
      <Notice searchParams={sp} />

      <TableCard>
        <Table caption="Admins" className="md:min-w-160">
          <thead>
            <tr><Th>Admin</Th><Th>Status</Th><Th className="hidden md:table-cell">Last sign-in</Th><Th><span className="sr-only">Actions</span></Th></tr>
          </thead>
          <tbody>
            {admins.map((a) => {
              const active = a.status === "ACTIVE";
              const isMe = a.id === me.id;
              return (
                <Tr key={a.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={a.name} />
                      <div className="min-w-0">
                        <p className="font-semibold">{a.name}{isMe && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}</p>
                        <p className="truncate text-muted">{a.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <StatusBadge status={a.status} />
                    {a.mustChangePassword && <p className="mt-1 text-xs text-warning">Password change pending</p>}
                  </Td>
                  <Td className="hidden whitespace-nowrap text-muted md:table-cell">{a.lastLoginAt ? timeAgo(a.lastLoginAt) : "Never"}</Td>
                  <Td>
                    <div className="flex items-start justify-end gap-0.5">
                      {!isMe && <ResetAdminPasswordForm adminId={a.id} name={a.name} />}
                      {!isMe && (
                        <form action={setAdminStatusAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
                          <button className="btn-icon btn-sm" title={active ? "Deactivate" : "Reactivate"} aria-label={`${active ? "Deactivate" : "Reactivate"} ${a.name}`}>
                            {active ? <UserRoundX aria-hidden /> : <UserRoundCheck aria-hidden />}
                          </button>
                        </form>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableCard>

      <div className="mt-8"><AdminForm /></div>
    </>
  );
}
