"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function ConfirmDialog({ triggerLabel, title, description, confirmLabel = "X?c nh?n", destructive = false, onConfirm }: { triggerLabel: string; title: string; description: string; confirmLabel?: string; destructive?: boolean; onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant={destructive ? "destructive" : "outline"} />}>{triggerLabel}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogMedia><AlertTriangle aria-hidden="true" /></AlertDialogMedia><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Quay l?i</AlertDialogCancel><AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={() => { onConfirm?.(); toast.success("Thao t?c ?? ???c ghi nh?n trong giao di?n m?u."); setOpen(false); }}>{confirmLabel}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
