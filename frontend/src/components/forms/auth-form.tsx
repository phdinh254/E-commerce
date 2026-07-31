"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  login: { title: "Ch?o m?ng b?n tr? l?i", description: "??ng nh?p ?? theo d?i ??n h?ng v? qu?n l? t?i kho?n.", submit: "??ng nh?p" },
  register: { title: "T?o t?i kho?n", description: "L?u ??a ch?, theo d?i ??n v? mua s?m nhanh h?n.", submit: "??ng k?" },
  forgot: { title: "Qu?n m?t kh?u", description: "Nh?p email ?? nh?n h??ng d?n ??t l?i m?t kh?u.", submit: "G?i h??ng d?n" },
  reset: { title: "??t l?i m?t kh?u", description: "T?o m?t kh?u m?i c? ?t nh?t 8 k? t?.", submit: "C?p nh?t m?t kh?u" },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const schema = useMemo(() => z.object({ fullName: z.string().optional(), email: z.email("Email ch?a ??ng ??nh d?ng."), password: z.string().optional(), confirmPassword: z.string().optional() }).superRefine((values, context) => {
    if (mode === "register" && (!values.fullName || values.fullName.trim().length < 2)) context.addIssue({ code: "custom", path: ["fullName"], message: "H? t?n ph?i c? ?t nh?t 2 k? t?." });
    if (mode !== "forgot" && (!values.password || values.password.length < (mode === "login" ? 1 : 8))) context.addIssue({ code: "custom", path: ["password"], message: mode === "login" ? "Vui l?ng nh?p m?t kh?u." : "M?t kh?u ph?i c? ?t nh?t 8 k? t?." });
    if ((mode === "register" || mode === "reset") && values.confirmPassword !== values.password) context.addIssue({ code: "custom", path: ["confirmPassword"], message: "M?t kh?u x?c nh?n ch?a kh?p." });
  }), [mode]);
  const form = useForm<AuthValues>({ resolver: zodResolver(schema), defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" } });
  const mutation = useMutation({
    mutationFn: async (values: AuthValues) => {
      if (mode === "login") { await authApi.login({ email: values.email, password: values.password ?? "" }); return "??ng nh?p th?nh c?ng."; }
      if (mode === "register") { await authApi.register({ fullName: values.fullName ?? "", email: values.email, password: values.password ?? "" }); return "T?o t?i kho?n th?nh c?ng."; }
      // TODO(api): Backend does not expose forgot-password or reset-password endpoints yet.
      await new Promise((resolve) => setTimeout(resolve, 600));
      return mode === "forgot" ? "N?u email t?n t?i, h??ng d?n s? ???c g?i t?i h?p th?." : "M?t kh?u ?? ???c c?p nh?t trong ch? ?? giao di?n m?u.";
    },
    onSuccess: (message) => { toast.success(message); router.push(mode === "login" ? "/account" : mode === "register" ? "/login" : mode === "forgot" ? "/login" : "/login"); },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const config = content[mode];
  return (
    <div className="w-full max-w-md">
      <h1 className="text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{config.title}</h1>
      <p className="mt-3 leading-7 text-muted-foreground">{config.description}</p>
      <form className="mt-8 space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        {mode === "register" ? <div className="space-y-2"><Label htmlFor="fullName">H? v? t?n</Label><Input id="fullName" autoComplete="name" aria-invalid={Boolean(form.formState.errors.fullName)} {...form.register("fullName")} /><p className="text-xs text-muted-foreground">T?n n?y s? hi?n th? tr?n t?i kho?n v? ??n h?ng.</p>{form.formState.errors.fullName ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.fullName.message}</p> : null}</div> : null}
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" placeholder="ban@example.com" aria-invalid={Boolean(form.formState.errors.email)} {...form.register("email")} />{form.formState.errors.email ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.email.message}</p> : null}</div>
        {mode !== "forgot" ? <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">{mode === "reset" ? "M?t kh?u m?i" : "M?t kh?u"}</Label>{mode === "login" ? <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Qu?n m?t kh?u?</Link> : null}</div><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} className="pr-11" aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "?n m?t kh?u" : "Hi?n m?t kh?u"} className="absolute right-1 top-1 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button></div>{form.formState.errors.password ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.password.message}</p> : null}</div> : null}
        {mode === "register" || mode === "reset" ? <div className="space-y-2"><Label htmlFor="confirmPassword">X?c nh?n m?t kh?u</Label><Input id="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" aria-invalid={Boolean(form.formState.errors.confirmPassword)} {...form.register("confirmPassword")} />{form.formState.errors.confirmPassword ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.confirmPassword.message}</p> : null}</div> : null}
        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "?ang x? l?..." : config.submit}</Button>
      </form>
      {mode === "login" ? <p className="mt-6 text-center text-sm text-muted-foreground">Ch?a c? t?i kho?n? <Link href="/register" className="font-semibold text-primary hover:underline">??ng k?</Link></p> : null}
      {mode === "register" ? <p className="mt-6 text-center text-sm text-muted-foreground">?? c? t?i kho?n? <Link href="/login" className="font-semibold text-primary hover:underline">??ng nh?p</Link></p> : null}
      {mode === "forgot" || mode === "reset" ? <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold text-primary hover:underline">Quay l?i ??ng nh?p</Link></p> : null}
    </div>
  );
}
