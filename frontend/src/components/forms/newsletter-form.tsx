"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  return (
    <form className="flex max-w-md gap-2" onSubmit={(event) => { event.preventDefault(); if (!email.includes("@")) { toast.error("Vui l?ng nh?p email h?p l?."); return; } toast.success("?? ??ng k? nh?n b?n tin."); setEmail(""); }}>
      <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" aria-label="Email nh?n b?n tin" placeholder="ban@example.com" className="h-11 bg-background" />
      <Button type="submit" size="lg" aria-label="??ng k? nh?n b?n tin"><ArrowRight aria-hidden="true" /></Button>
    </form>
  );
}
