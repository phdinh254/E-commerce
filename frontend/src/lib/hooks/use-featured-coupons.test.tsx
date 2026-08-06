import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { couponsApi } from "@/lib/api/coupons";
import { useFeaturedCoupons } from "./use-featured-coupons";

vi.mock("@/lib/api/coupons", () => ({ couponsApi: { getFeatured: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useFeaturedCoupons", () => {
  it("fetches featured coupons and forwards the limit", async () => {
    vi.mocked(couponsApi.getFeatured).mockResolvedValue([
      { code: "WELCOME10" } as never,
    ]);

    const { result } = renderHook(() => useFeaturedCoupons(4), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(couponsApi.getFeatured).toHaveBeenCalledWith(4, expect.anything());
  });
});
