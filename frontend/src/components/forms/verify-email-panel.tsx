"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/client";
import { useAuthEmailAction } from "@/lib/hooks/use-auth-email-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VerifyEmailPanel() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const attemptedRef = useRef(false);

  const verifyMutation = useMutation({
    mutationFn: (t: string) => authApi.verifyEmail(t),
  });

  useEffect(() => {
    if (!token || attemptedRef.current) return;
    attemptedRef.current = true;
    verifyMutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resend = useAuthEmailAction((email: string) => authApi.resendVerification(email));
  const [resendEmail, setResendEmail] = useState("");

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-[-0.045em]">Thiếu đường dẫn xác minh</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Đường dẫn xác minh không hợp lệ. Vui lòng mở lại email xác minh hoặc yêu cầu gửi lại bên dưới.
        </p>
        <ResendForm
          email={resendEmail}
          onEmailChange={setResendEmail}
          onSubmit={() => resend.run(resendEmail)}
          isPending={resend.isPending}
          isCoolingDown={resend.isCoolingDown}
          successMessage={resend.successMessage}
          errorMessage={resend.errorMessage}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-semibold tracking-[-0.045em]">Xác minh tài khoản</h1>
      {verifyMutation.isPending || verifyMutation.isIdle ? (
        <p className="mt-3 leading-7 text-muted-foreground">Đang xác minh tài khoản của bạn...</p>
      ) : null}
      {verifyMutation.isSuccess ? (
        <>
          <p className="mt-3 leading-7 text-muted-foreground">
            Tài khoản của bạn đã được xác minh thành công.
          </p>
          <Link href="/login" className="mt-6 inline-block font-semibold text-primary hover:underline">
            Đăng nhập ngay
          </Link>
        </>
      ) : null}
      {verifyMutation.isError ? (
        <>
          <p className="mt-3 leading-7 text-destructive" role="alert">
            {getApiErrorMessage(verifyMutation.error)}
          </p>
          <ResendForm
            email={resendEmail}
            onEmailChange={setResendEmail}
            onSubmit={() => resend.run(resendEmail)}
            isPending={resend.isPending}
            isCoolingDown={resend.isCoolingDown}
            successMessage={resend.successMessage}
            errorMessage={resend.errorMessage}
          />
        </>
      ) : null}
    </div>
  );
}

function ResendForm(props: {
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  isCoolingDown: boolean;
  successMessage: string | null;
  errorMessage: string | null;
}) {
  return (
    <div className="mt-6 space-y-3">
      <Label htmlFor="resend-email">Gửi lại email xác minh</Label>
      <div className="flex gap-2">
        <Input
          id="resend-email"
          type="email"
          placeholder="ban@example.com"
          value={props.email}
          onChange={(event) => props.onEmailChange(event.target.value)}
        />
        <Button
          type="button"
          onClick={props.onSubmit}
          disabled={props.isPending || props.isCoolingDown || !props.email}
        >
          {props.isPending ? "Đang gửi..." : props.isCoolingDown ? "Đã gửi" : "Gửi lại"}
        </Button>
      </div>
      {props.successMessage ? (
        <p className="text-sm text-muted-foreground">{props.successMessage}</p>
      ) : null}
      {props.errorMessage ? (
        <p className="text-sm text-destructive" role="alert">{props.errorMessage}</p>
      ) : null}
    </div>
  );
}
