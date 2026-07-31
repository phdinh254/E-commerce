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
    helper.accessor("status", { header: "Tr?ng th?i", cell: (info) => <StatusBadge status={info.getValue()} /> }),
    helper.accessor("meta", { header: "Th?ng tin", cell: (info) => <span className="text-sm text-muted-foreground">{info.getValue()}</span> }),
    helper.display({ id: "actions", header: "", cell: (info) => <div className="flex justify-end gap-2">{detailBase ? <Link href={`${detailBase}/${info.row.original.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Xem</Link> : <Button variant="outline" size="sm">S?a</Button>}{canDelete ? <ConfirmDialog triggerLabel="X?a" title="X?c nh?n thao t?c" description="D? li?u c? th? ?nh h??ng t?i ho?t ??ng v?n h?nh. H?y ki?m tra tr??c khi ti?p t?c." confirmLabel="X?c nh?n" destructive /> : null}</div> }),
  ], [resource, detailBase, canDelete]);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table exposes stateful closures by design.
  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 8 } } });
  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`T?m ${resource.toLocaleLowerCase("vi")}...`} aria-label={`T?m ${resource}`} className="h-10 pl-9" /></div><p className="text-sm text-muted-foreground">{filtered.length} b?n ghi</p></div>
      {filtered.length ? <><div className="overflow-x-auto"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className={header.id === "actions" ? "text-right" : ""}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table></div><div className="flex items-center justify-between border-t p-4"><p className="text-xs text-muted-foreground">Trang {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}</p><div className="flex gap-2"><Button variant="outline" size="icon-sm" aria-label="Trang tr??c" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft aria-hidden="true" /></Button><Button variant="outline" size="icon-sm" aria-label="Trang sau" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight aria-hidden="true" /></Button></div></div></> : <div className="p-4"><StatePanel kind="empty" title="Kh?ng c? d? li?u" description="Kh?ng t?m th?y b?n ghi ph? h?p v?i t? kh?a ho?c b? l?c hi?n t?i." /></div>}
    </div>
  );
}
