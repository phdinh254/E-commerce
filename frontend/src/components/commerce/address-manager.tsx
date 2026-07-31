"use client";

import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import type { Address } from "@/types/commerce";

export function AddressManager({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      {addresses.map((address) => <article key={address.id} className="rounded-2xl border bg-card p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><MapPin className="size-5" aria-hidden="true" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{address.recipientName}</h2>{address.isDefault ? <span className="rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">Mặc định</span> : null}</div><p className="mt-1 text-sm text-muted-foreground">{address.phoneNumber}</p><p className="mt-2 max-w-xl text-sm leading-6">{address.streetAddress}, {address.ward}, {address.district}, {address.province}</p></div></div><div className="flex gap-2 pl-13 sm:pl-0"><Button variant="outline" size="sm">Chỉnh sửa</Button><ConfirmDialog triggerLabel="Xóa" title="Xóa địa chỉ này?" description="Địa chỉ sẽ không còn khả dụng cho lần thanh toán tiếp theo." confirmLabel="Xóa địa chỉ" destructive onConfirm={() => setAddresses((current) => current.filter((item) => item.id !== address.id))} /></div></div></article>)}
      {adding ? <form className="rounded-2xl border bg-card p-5" onSubmit={(event) => { event.preventDefault(); setAdding(false); toast.success("Đã thêm địa chỉ trong giao diện mẫu."); }}><h2 className="text-lg font-semibold">Địa chỉ mới</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-recipient">Người nhận</Label><Input id="new-recipient" required /></div><div className="space-y-2"><Label htmlFor="new-phone">Số điện thoại</Label><Input id="new-phone" required inputMode="tel" /></div><div className="space-y-2"><Label htmlFor="new-province">Tỉnh hoặc thành phố</Label><Input id="new-province" required /></div><div className="space-y-2"><Label htmlFor="new-district">Quận hoặc huyện</Label><Input id="new-district" required /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="new-address">Địa chỉ chi tiết</Label><Input id="new-address" required /></div></div><div className="mt-5 flex gap-2"><Button type="submit">Lưu địa chỉ</Button><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Hủy</Button></div></form> : <Button variant="outline" size="lg" onClick={() => setAdding(true)}><Plus aria-hidden="true" />Thêm địa chỉ</Button>}
    </div>
  );
}
