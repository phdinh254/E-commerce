"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { StatePanel } from "@/components/feedback/state-panel";
import { cn } from "@/lib/utils";
import type { AdminTableRow } from "@/types/commerce";

const helper = createColumnHelper<AdminTableRow>();

export function AdminDataTable({ data, resource, detailBase, canDelete = true }: { data: AdminTableRow[]; resource: string; detailBase?: string; canDelete?: boolean }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => data.filter((row) => `${row.primary} ${row.secondary} ${row.status}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))), [data, query]);
  const columns = useMemo(() => [
    helper.accessor("primary", { header: resource, cell: (info) => <div><p className="max-w-md truncate font-medium">{info.getValue()}</p><p className="mt-1 max-w-md truncate text-xs text-muted-foreground">{info.row.original.secondary}</p></div> }),
    helper.accessor("status", { header: "Trạng thái", cell: (info) => <StatusBadge status={info.getValue()} /> }),
    helper.accessor("meta", { header: "Thông tin", cell: (info) => <span className="text-sm text-muted-foreground">{info.getValue()}</span> }),
    helper.display({ id: "actions", header: "", cell: (info) => <div className="flex justify-end gap-2">{detailBase ? <Link href={`${detailBase}/${info.row.original.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Xem</Link> : <Button variant="outline" size="sm">Sửa</Button>}{canDelete ? <ConfirmDialog triggerLabel="Xóa" title="Xác nhận thao tác" description="Dữ liệu có thể ảnh hưởng đến hoạt động vận hành. Hãy kiểm tra kỹ trước khi tiếp tục." confirmLabel="Xác nhận" destructive /> : null}</div> }),
  ], [resource, detailBase, canDelete]);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table exposes stateful closures by design.
  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 8 } } });
  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Tìm ${resource.toLocaleLowerCase("vi")}...`} aria-label={`Tìm ${resource}`} className="h-10 pl-9" /></div><p className="text-sm text-muted-foreground">{filtered.length} bản ghi</p></div>
      {filtered.length ? <><div className="overflow-x-auto"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className={header.id === "actions" ? "text-right" : ""}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table></div><div className="flex items-center justify-between border-t p-4"><p className="text-xs text-muted-foreground">Trang {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}</p><div className="flex gap-2"><Button variant="outline" size="icon-sm" aria-label="Trang trước" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft aria-hidden="true" /></Button><Button variant="outline" size="icon-sm" aria-label="Trang sau" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight aria-hidden="true" /></Button></div></div></> : <div className="p-4"><StatePanel kind="empty" title="Không có dữ liệu" description="Không tìm thấy bản ghi phù hợp với từ khóa hoặc bộ lọc hiện tại." /></div>}
    </div>
  );
}
