import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAddresses } from "@/lib/hooks/use-addresses";
import { useDeleteAddress } from "@/lib/hooks/use-delete-address";
import { useSetDefaultAddress } from "@/lib/hooks/use-set-default-address";
import { AddressManager } from "./address-manager";
import type { Address } from "@/types/address";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/hooks/use-addresses", () => ({ useAddresses: vi.fn() }));
vi.mock("@/lib/hooks/use-delete-address", () => ({ useDeleteAddress: vi.fn() }));
vi.mock("@/lib/hooks/use-set-default-address", () => ({ useSetDefaultAddress: vi.fn() }));
// AddressFormDialog has its own dedicated test file.
vi.mock("@/components/commerce/address-form-dialog", () => ({
  AddressFormDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="address-form-dialog" /> : null),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const DEFAULT_ADDRESS: Address = {
  id: "address-1",
  label: "Nhà riêng",
  recipientName: "Nguyen Van A",
  phoneNumber: "0912345678",
  province: "Ha Noi",
  district: "Cau Giay",
  ward: "Dich Vong",
  streetAddress: "123 Xuan Thuy",
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const SECOND_ADDRESS: Address = { ...DEFAULT_ADDRESS, id: "address-2", isDefault: false, recipientName: "Tran Thi B" };

describe("AddressManager", () => {
  it("shows a loading state", () => {
    vi.mocked(useAddresses).mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() } as never);
    vi.mocked(useDeleteAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useSetDefaultAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<AddressManager />);

    expect(screen.queryByText(/Nguyen Van A/)).not.toBeInTheDocument();
  });

  it("shows a retry action on error", async () => {
    const refetch = vi.fn();
    vi.mocked(useAddresses).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network down"),
      refetch,
    } as never);
    vi.mocked(useDeleteAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useSetDefaultAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    const user = userEvent.setup();
    render(<AddressManager />);
    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when there are no addresses", () => {
    vi.mocked(useAddresses).mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() } as never);
    vi.mocked(useDeleteAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useSetDefaultAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<AddressManager />);

    expect(screen.getByText("Bạn chưa có địa chỉ nào được lưu.")).toBeInTheDocument();
  });

  it("renders the default badge only on the default address, and no set-default button for it", () => {
    vi.mocked(useAddresses).mockReturnValue({
      data: [DEFAULT_ADDRESS, SECOND_ADDRESS],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useDeleteAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useSetDefaultAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<AddressManager />);

    expect(screen.getByText("Mặc định")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Đặt làm mặc định" })).toHaveLength(1);
  });

  it("calls setDefault when clicking the action on a non-default address", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAddresses).mockReturnValue({
      data: [DEFAULT_ADDRESS, SECOND_ADDRESS],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useDeleteAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useSetDefaultAddress).mockReturnValue({ mutateAsync, isPending: false } as never);

    const user = userEvent.setup();
    render(<AddressManager />);
    await user.click(screen.getByRole("button", { name: "Đặt làm mặc định" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith("address-2"));
  });

  it("opens the create dialog when clicking Thêm địa chỉ", async () => {
    vi.mocked(useAddresses).mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() } as never);
    vi.mocked(useDeleteAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useSetDefaultAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    const user = userEvent.setup();
    render(<AddressManager />);
    expect(screen.queryByTestId("address-form-dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Thêm địa chỉ/ }));

    expect(screen.getByTestId("address-form-dialog")).toBeInTheDocument();
  });
});
