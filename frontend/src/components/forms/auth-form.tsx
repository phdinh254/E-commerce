"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AuthMode = "login" | "register" | "forgot" | "reset";
interface AuthValues { fullName?: string; email: string; password?: string; confirmPassword?: string; }

const content = {
  login: { title: "Chào mừng bạn trở lại", description: "Đăng nhập để theo dõi đơn hàng và quản lý tài khoản của bạn.", submit: "Đăng nhập" },
  register: { title: "Tạo tài khoản", description: "Lưu địa chỉ, theo dõi đơn hàng và mua sắm nhanh hơn.", submit: "Đăng ký" },
  forgot: { title: "Quên mật khẩu", description: "Nhập email để nhận hướng dẫn đặt lại mật khẩu.", submit: "Gửi hướng dẫn" },
  reset: { title: "Đặt lại mật khẩu", description: "Tạo mật khẩu mới có ít nhất 8 ký tự.", submit: "Cập nhật mật khẩu" },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  return (
    <Suspense fallback={null}>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}

function AuthFormInner({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = mode === "reset" ? searchParams.get("token") : null;
  const [showPassword, setShowPassword] = useState(false);
  const schema = useMemo(() => z.object({ fullName: z.string().optional(), email: z.email("Email chưa đúng định dạng."), password: z.string().optional(), confirmPassword: z.string().optional() }).superRefine((values, context) => {
    if (mode === "register" && (!values.fullName || values.fullName.trim().length < 2)) context.addIssue({ code: "custom", path: ["fullName"], message: "Họ tên phải có ít nhất 2 ký tự." });
    if (mode !== "forgot" && (!values.password || values.password.length < (mode === "login" ? 1 : 8))) context.addIssue({ code: "custom", path: ["password"], message: mode === "login" ? "Vui lòng nhập mật khẩu." : "Mật khẩu phải có ít nhất 8 ký tự." });
    if ((mode === "register" || mode === "reset") && values.confirmPassword !== values.password) context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Mật khẩu xác nhận chưa khớp." });
  }), [mode]);
  const form = useForm<AuthValues>({ resolver: zodResolver(schema), defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" } });
  const mutation = useMutation({
    mutationFn: async (values: AuthValues) => {
      if (mode === "login") { await authApi.login({ email: values.email, password: values.password ?? "" }); return "Đăng nhập thành công."; }
      if (mode === "register") { await authApi.register({ fullName: values.fullName ?? "", email: values.email, password: values.password ?? "" }); return "Tạo tài khoản thành công. Vui lòng kiểm tra email để xác minh tài khoản."; }
      if (mode === "forgot") { const { message } = await authApi.forgotPassword(values.email); return message; }
      if (!resetToken) throw new Error("MISSING_RESET_TOKEN");
      const { message } = await authApi.resetPassword(resetToken, values.password ?? "");
      return message;
    },
    onSuccess: (message) => { toast.success(message); router.push(mode === "login" ? "/account" : "/login"); },
    onError: (error) => {
      if (error instanceof Error && error.message === "MISSING_RESET_TOKEN") {
        toast.error("Đường dẫn đặt lại mật khẩu không hợp lệ. Vui lòng yêu cầu lại.");
        return;
      }
      toast.error(getApiErrorMessage(error));
    },
  });
  const config = content[mode];
  return (
    <div className="w-full max-w-md">
      <h1 className="text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{config.title}</h1>
      <p className="mt-3 leading-7 text-muted-foreground">{config.description}</p>
      <form className="mt-8 space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        {mode === "register" ? <div className="space-y-2"><Label htmlFor="fullName">Họ và tên</Label><Input id="fullName" autoComplete="name" aria-invalid={Boolean(form.formState.errors.fullName)} {...form.register("fullName")} /><p className="text-xs text-muted-foreground">Tên này sẽ hiển thị trong tài khoản và trên đơn hàng của bạn.</p>{form.formState.errors.fullName ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.fullName.message}</p> : null}</div> : null}
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" placeholder="ban@example.com" aria-invalid={Boolean(form.formState.errors.email)} {...form.register("email")} />{form.formState.errors.email ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.email.message}</p> : null}</div>
        {mode !== "forgot" ? <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">{mode === "reset" ? "Mật khẩu mới" : "Mật khẩu"}</Label>{mode === "login" ? <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Quên mật khẩu?</Link> : null}</div><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} className="pr-11" aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="absolute right-1 top-1 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button></div>{form.formState.errors.password ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.password.message}</p> : null}</div> : null}
        {mode === "register" || mode === "reset" ? <div className="space-y-2"><Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label><Input id="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" aria-invalid={Boolean(form.formState.errors.confirmPassword)} {...form.register("confirmPassword")} />{form.formState.errors.confirmPassword ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.confirmPassword.message}</p> : null}</div> : null}
        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "Đang xử lý..." : config.submit}</Button>
      </form>
      {mode === "login" ? <p className="mt-6 text-center text-sm text-muted-foreground">Chưa có tài khoản? <Link href="/register" className="font-semibold text-primary hover:underline">Đăng ký</Link></p> : null}
      {mode === "register" ? <p className="mt-6 text-center text-sm text-muted-foreground">Đã có tài khoản? <Link href="/login" className="font-semibold text-primary hover:underline">Đăng nhập</Link></p> : null}
      {mode === "forgot" || mode === "reset" ? <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold text-primary hover:underline">Quay lại đăng nhập</Link></p> : null}
    </div>
  );
}
