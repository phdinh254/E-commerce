import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/auth-form";
export const metadata: Metadata = { title: "??ng k?" };
export default function RegisterPage() { return <AuthForm mode="register" />; }
