"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePreviewCoupon } from "@/lib/hooks/use-preview-coupon";
import { useApplyCoupon } from "@/lib/hooks/use-apply-coupon";
import { getApiErrorMessage } from "@/lib/api/client";

/**
 * Submit calls preview first (so the preview endpoint is actually used in
 * the UX, not built-and-abandoned) — if the code validates, apply runs
 * immediately after in the same submit so the user gets a one-step "Áp
 * dụng" flow instead of a separate confirm click. If preview says invalid,
 * apply never runs and the current applied coupon (if any) is untouched.
 */
export function CouponInput({ disabled = false }: { disabled?: boolean }) {
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const previewMutation = usePreviewCoupon();
  const applyMutation = useApplyCoupon();

  const isPending = previewMutation.isPending || applyMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || isPending || disabled) return;

    setErrorMessage(null);
    try {
      const preview = await previewMutation.mutateAsync(trimmed);
      if (!preview.valid) {
        setErrorMessage(preview.message);
        return;
      }
      await applyMutation.mutateAsync(trimmed);
      setCode("");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-2" noValidate>
      <Label htmlFor={inputId}>Mã giảm giá</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          name="coupon-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Nhập mã giảm giá"
          disabled={isPending || disabled}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? errorId : undefined}
          autoComplete="off"
        />
        <Button type="submit" disabled={isPending || disabled || code.trim().length === 0}>
          {isPending ? "Đang áp dụng..." : "Áp dụng"}
        </Button>
      </div>
      {errorMessage ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
