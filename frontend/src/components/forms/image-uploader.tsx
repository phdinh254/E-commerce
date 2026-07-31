"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ImageUploader({ initialImage }: { initialImage?: string }) {
  const [preview, setPreview] = useState(initialImage ?? "");
  useEffect(() => () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <div className="space-y-2"><Label htmlFor="product-image">?nh s?n ph?m</Label><label htmlFor="product-image" className="grid cursor-pointer gap-4 rounded-2xl border border-dashed bg-muted/45 p-4 text-center hover:border-primary/55"><div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl bg-card">{preview ? <Image src={preview} alt="?nh xem tr??c c?a s?n ph?m" fill unoptimized={preview.startsWith("blob:")} className="object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground"><div><ImagePlus className="mx-auto size-8" aria-hidden="true" /><p className="mt-3 text-sm font-medium">Ch?n ?nh ?? t?i l?n</p></div></div>}</div><span className="text-xs text-muted-foreground">PNG, JPG ho?c WebP. T?i ?a 5 MB.</span></label><Input id="product-image" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} /><p className="text-xs text-muted-foreground">TODO(api): upload qua backend StorageProvider, kh?ng ??a Supabase service role key ra frontend.</p></div>
  );
}
