import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/forms/profile-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Tài khoản" };
export default function AccountPage() { return <><PageHeader title="Tài khoản của tôi" description="Quản lý thông tin cá nhân và bảo mật tài khoản." /><div className="mt-8 space-y-6"><ProfileForm /><section id="password" className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Đổi mật khẩu</h2><p className="mt-1 text-sm text-muted-foreground">Tính năng đổi mật khẩu đang được hoàn thiện và sẽ sớm khả dụng.</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="current-password">Mật khẩu hiện tại</Label><Input id="current-password" type="password" disabled /></div><div className="space-y-2"><Label htmlFor="new-password">Mật khẩu mới</Label><Input id="new-password" type="password" disabled /></div><div className="space-y-2"><Label htmlFor="confirm-new-password">Xác nhận mật khẩu mới</Label><Input id="confirm-new-password" type="password" disabled /></div></div><Button className="mt-5" disabled>Cập nhật mật khẩu</Button></section></div></>; }
