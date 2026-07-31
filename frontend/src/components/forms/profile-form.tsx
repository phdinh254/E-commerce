"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm() {
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false); toast.success("?? l?u th?ng tin c? nh?n trong giao di?n m?u."); }
  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6"><div><h2 className="text-lg font-semibold">Th?ng tin c? nh?n</h2><p className="mt-1 text-sm text-muted-foreground">Email ???c qu?n l? b?i t?i kho?n ??ng nh?p.</p></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-name">H? v? t?n</Label><Input id="profile-name" defaultValue="Nguy?n Minh Anh" autoComplete="name" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-email">Email</Label><Input id="profile-email" defaultValue="minhanh@example.com" disabled /><p className="text-xs text-muted-foreground">Li?n h? h? tr? n?u b?n c?n thay ??i email.</p></div><div className="space-y-2"><Label htmlFor="profile-phone">S? ?i?n tho?i</Label><Input id="profile-phone" defaultValue="090 123 4567" inputMode="tel" /></div><div className="space-y-2"><Label htmlFor="profile-birthday">Ng?y sinh</Label><Input id="profile-birthday" type="date" defaultValue="1995-05-18" /></div></div><Button type="submit" disabled={saving}>{saving ? "?ang l?u..." : "L?u thay ??i"}</Button></form>
  );
}
