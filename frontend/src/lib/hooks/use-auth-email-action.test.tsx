import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuthEmailAction } from "./use-auth-email-action";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useAuthEmailAction", () => {
  it("starts idle: not pending, no messages", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useAuthEmailAction(action), { wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.successMessage).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  it("calls the action and exposes the success message", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Đã gửi email." });
    const { result } = renderHook(() => useAuthEmailAction(action), { wrapper });

    act(() => result.current.run("user@example.com"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(action.mock.calls[0]?.[0]).toBe("user@example.com");
    expect(result.current.successMessage).toBe("Đã gửi email.");
  });

  it("exposes a human-readable error message when the action rejects", async () => {
    const action = vi.fn().mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useAuthEmailAction(action), { wrapper });

    act(() => result.current.run("user@example.com"));

    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(result.current.errorMessage).toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
  });

  it("ignores a second run() call while the first is still pending (no double-submit)", async () => {
    let resolveAction: (value: { message: string }) => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<{ message: string }>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const { result } = renderHook(() => useAuthEmailAction(action), { wrapper });

    await act(async () => {
      result.current.run("user@example.com");
      await Promise.resolve();
    });
    act(() => result.current.run("user@example.com"));

    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAction({ message: "ok" });
    });
  });

  it("enters a cooldown after success and ignores run() until it elapses", async () => {
    vi.useFakeTimers();
    const action = vi.fn().mockResolvedValue({ message: "Đã gửi." });
    const { result } = renderHook(() => useAuthEmailAction(action, 30_000), {
      wrapper,
    });

    await act(async () => {
      result.current.run("user@example.com");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isCoolingDown).toBe(true);

    act(() => result.current.run("user@example.com"));
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.isCoolingDown).toBe(false);
  });
});
