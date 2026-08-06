"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function ConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmLabel = "Xác nhận",
  destructive = false,
  onConfirm,
  /** Callers backed by a real mutation (which already toasts on success/error
   * and reports its own error) should pass `false` here — otherwise this
   * dialog would claim success from a canned message before an async
   * `onConfirm` has even resolved, or right after it actually failed. */
  showDefaultSuccessToast = true,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void | Promise<void>;
  showDefaultSuccessToast?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm?.();
      if (showDefaultSuccessToast) {
        toast.success("Thao tác đã được ghi nhận trong giao diện mẫu.");
      }
      setOpen(false);
    } catch {
      // Real mutations report their own error toast (see callers passing
      // showDefaultSuccessToast=false) — swallow here so the dialog itself
      // never double-toasts; keep the dialog open so the user can retry.
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant={destructive ? "destructive" : "outline"} />}>{triggerLabel}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogMedia><AlertTriangle aria-hidden="true" /></AlertDialogMedia><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Quay lại</AlertDialogCancel><AlertDialogAction variant={destructive ? "destructive" : "default"} disabled={pending} onClick={handleConfirm}>{pending ? "Đang xử lý..." : confirmLabel}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
