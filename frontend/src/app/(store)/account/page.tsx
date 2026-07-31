import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/forms/profile-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "T?i kho?n" };
export default function AccountPage() { return <><PageHeader title="T?i kho?n c?a t?i" description="Qu?n l? th?ng tin c? nh?n v? b?o m?t t?i kho?n." /><div className="mt-8 space-y-6"><ProfileForm /><section id="password" className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Thay ??i m?t kh?u</h2><p className="mt-1 text-sm text-muted-foreground">Backend hi?n ch?a c? endpoint ??i m?t kh?u. Form ???c chu?n b? cho contract t??ng lai.</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="current-password">M?t kh?u hi?n t?i</Label><Input id="current-password" type="password" disabled /></div><div className="space-y-2"><Label htmlFor="new-password">M?t kh?u m?i</Label><Input id="new-password" type="password" disabled /></div><div className="space-y-2"><Label htmlFor="confirm-new-password">X?c nh?n m?t kh?u m?i</Label><Input id="confirm-new-password" type="password" disabled /></div></div><Button className="mt-5" disabled>C?p nh?t m?t kh?u</Button></section></div></>; }
