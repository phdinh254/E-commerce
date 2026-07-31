"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  return (
    <form className="flex max-w-md gap-2" onSubmit={(event) => { event.preventDefault(); if (!email.includes("@")) { toast.error("Vui lòng nhập email hợp lệ."); return; } toast.success("Đã đăng ký nhận bản tin."); setEmail(""); }}>
      <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" aria-label="Email nhận bản tin" placeholder="ban@example.com" className="h-11 bg-background" />
      <Button type="submit" size="lg" aria-label="Đăng ký nhận bản tin"><ArrowRight aria-hidden="true" /></Button>
    </form>
  );
}
