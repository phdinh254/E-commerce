import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/auth-form";
export const metadata: Metadata = { title: "??t l?i m?t kh?u" };
export default function ResetPasswordPage() { return <AuthForm mode="reset" />; }
