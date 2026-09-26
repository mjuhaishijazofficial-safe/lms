import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { listRecentMaterials } from "@/server/services/library";
import { PAGE_SIZE } from "@/server/services/_shared";
import { pageParam } from "@/lib/params";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { RecentMaterialCard } from "@/components/student/recent-material-card";

export const metadata: Metadata = { title: "Recent Materials" };

export default async function RecentPage({ searchParams }: PageProps<"/recent">) {
  const user = await requireStudent();
  const page = pageParam(await searchParams);
  const { rows, total } = await listRecentMaterials(user.id, page);

  return (
    <>
      <PageHeader title="Recent Materials" description="The newest study material available to you, newest first." />
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={Clock} title="No study material has been added yet." description="New material will show up here as soon as your admin adds it." />
        </div>
      ) : (
        <>
          <div className="card divide-y divide-line">{rows.map((m) => <RecentMaterialCard key={m.id} material={m} />)}</div>
          <div className="card mt-4 overflow-hidden"><Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/recent" params={{}} /></div>
        </>
      )}
    </>
  );
}
