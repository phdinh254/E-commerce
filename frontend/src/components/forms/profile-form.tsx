"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm() {
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false); toast.success("Đã lưu thông tin cá nhân trong bản dùng thử."); }
  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6"><div><h2 className="text-lg font-semibold">Thông tin cá nhân</h2><p className="mt-1 text-sm text-muted-foreground">Email được quản lý theo tài khoản đăng nhập.</p></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-name">Họ và tên</Label><Input id="profile-name" defaultValue="Nguyễn Minh Anh" autoComplete="name" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-email">Email</Label><Input id="profile-email" defaultValue="minhanh@example.com" disabled /><p className="text-xs text-muted-foreground">Liên hệ bộ phận hỗ trợ nếu bạn cần thay đổi email.</p></div><div className="space-y-2"><Label htmlFor="profile-phone">Số điện thoại</Label><Input id="profile-phone" defaultValue="090 123 4567" inputMode="tel" /></div><div className="space-y-2"><Label htmlFor="profile-birthday">Ngày sinh</Label><Input id="profile-birthday" type="date" defaultValue="1995-05-18" /></div></div><Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</Button></form>
  );
}
