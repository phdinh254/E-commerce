"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/lib/hooks/use-profile";
import { useUpdateProfile } from "@/lib/hooks/use-update-profile";
import { getApiErrorMessage } from "@/lib/api/client";

const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Họ tên phải có ít nhất 2 ký tự.")
    .max(255, "Họ tên không được vượt quá 255 ký tự."),
});
type ProfileValues = z.infer<typeof profileSchema>;

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

export function ProfileForm() {
  const { data: profile, isLoading, isError, error, refetch } = useProfile();
  const updateProfile = useUpdateProfile();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "" },
  });

  // Initializes from server data once loaded — never resets on a background
  // refetch afterward (only fires while the form hasn't been touched yet),
  // so it can't clobber text the user is actively editing.
  useEffect(() => {
    if (profile && !form.formState.isDirty) {
      form.reset({ fullName: profile.fullName });
    }
  }, [profile, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync(values.fullName);
      toast.success("Đã lưu thông tin cá nhân.");
      form.reset(values);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />;
  }

  if (isError || !profile) {
    return (
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6" noValidate>
      <div>
        <h2 className="text-lg font-semibold">Thông tin cá nhân</h2>
        <p className="mt-1 text-sm text-muted-foreground">Email được quản lý theo tài khoản đăng nhập.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="profile-name">Họ và tên</Label>
          <Input
            id="profile-name"
            autoComplete="name"
            aria-invalid={Boolean(form.formState.errors.fullName)}
            {...form.register("fullName")}
          />
          <FieldError message={form.formState.errors.fullName?.message} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={profile.email} disabled readOnly />
          <p className="text-xs text-muted-foreground">Liên hệ bộ phận hỗ trợ nếu bạn cần thay đổi email.</p>
        </div>
      </div>
      <Button type="submit" disabled={updateProfile.isPending || !form.formState.isDirty}>
        {updateProfile.isPending ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  );
}
