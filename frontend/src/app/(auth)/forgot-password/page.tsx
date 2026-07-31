import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/auth-form";
export const metadata: Metadata = { title: "Qu?n m?t kh?u" };
export default function ForgotPasswordPage() { return <AuthForm mode="forgot" />; }
