import Link from "next/link";
import { Plus } from "lucide-react";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function AdminResourcePage({ resource, resourceLabel, title, description, createHref, detailBase, canDelete = true }: { resource: string; resourceLabel: string; title: string; description: string; createHref?: string; detailBase?: string; canDelete?: boolean }) {
  const rows = await commerceRepository.getAdminRows(resource);
  return (
    <div className="mx-auto max-w-[1400px]"><PageHeader title={title} description={description} action={createHref ? <Link href={createHref} className={cn(buttonVariants({ size: "lg" }))}><Plus aria-hidden="true" />Thêm mới</Link> : undefined} /><div className="mt-6"><AdminDataTable data={rows} resource={resourceLabel} detailBase={detailBase} canDelete={canDelete} /></div><p className="mt-3 text-xs text-muted-foreground">Dữ liệu minh họa đang được sử dụng trong khi tính năng đồng bộ với hệ thống được hoàn thiện.</p></div>
  );
}
