import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCreateAddress } from "@/lib/hooks/use-create-address";
import { useUpdateAddress } from "@/lib/hooks/use-update-address";
import { AddressFormDialog } from "./address-form-dialog";
import type { Address } from "@/types/address";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/hooks/use-create-address", () => ({ useCreateAddress: vi.fn() }));
vi.mock("@/lib/hooks/use-update-address", () => ({ useUpdateAddress: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

const ADDRESS: Address = {
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

async function fillMinimalFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Người nhận"), "Nguyen Van A");
  await user.type(screen.getByLabelText("Số điện thoại"), "0912345678");
  await user.type(screen.getByLabelText("Tỉnh hoặc thành phố"), "Ha Noi");
  await user.type(screen.getByLabelText("Quận hoặc huyện"), "Cau Giay");
  await user.type(screen.getByLabelText("Phường hoặc xã"), "Dich Vong");
  await user.type(screen.getByLabelText("Địa chỉ chi tiết"), "123 Xuan Thuy");
}

describe("AddressFormDialog", () => {
  it("create mode: submits a fresh address without id/userId, omitting isDefault when unchecked", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(ADDRESS);
    vi.mocked(useCreateAddress).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useUpdateAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    const onOpenChange = vi.fn();

    const user = userEvent.setup();
    render(<AddressFormDialog open onOpenChange={onOpenChange} />);
    await fillMinimalFields(user);
    await user.click(screen.getByRole("button", { name: "Lưu địa chỉ" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual({
      label: undefined,
      recipientName: "Nguyen Van A",
      phoneNumber: "0912345678",
      province: "Ha Noi",
      district: "Cau Giay",
      ward: "Dich Vong",
      streetAddress: "123 Xuan Thuy",
      isDefault: undefined,
    });
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("userId");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("create mode: checking 'make default' sends isDefault=true", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(ADDRESS);
    vi.mocked(useCreateAddress).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useUpdateAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    const user = userEvent.setup();
    render(<AddressFormDialog open onOpenChange={vi.fn()} />);
    await fillMinimalFields(user);
    await user.click(screen.getByText("Đặt làm địa chỉ mặc định"));
    await user.click(screen.getByRole("button", { name: "Lưu địa chỉ" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.isDefault).toBe(true);
  });

  it("rejects an invalid phone number", async () => {
    const mutateAsync = vi.fn();
    vi.mocked(useCreateAddress).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useUpdateAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    const user = userEvent.setup();
    render(<AddressFormDialog open onOpenChange={vi.fn()} />);
    await user.type(screen.getByLabelText("Người nhận"), "Nguyen Van A");
    await user.type(screen.getByLabelText("Số điện thoại"), "123");
    await user.type(screen.getByLabelText("Tỉnh hoặc thành phố"), "Ha Noi");
    await user.type(screen.getByLabelText("Quận hoặc huyện"), "Cau Giay");
    await user.type(screen.getByLabelText("Phường hoặc xã"), "Dich Vong");
    await user.type(screen.getByLabelText("Địa chỉ chi tiết"), "123 Xuan Thuy");
    await user.click(screen.getByRole("button", { name: "Lưu địa chỉ" }));

    expect(await screen.findByText("Số điện thoại không hợp lệ.")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("edit mode: prefills from the given address and the default checkbox is checked+disabled when already default", () => {
    vi.mocked(useCreateAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useUpdateAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<AddressFormDialog open onOpenChange={vi.fn()} address={ADDRESS} />);

    expect(screen.getByLabelText("Người nhận")).toHaveValue("Nguyen Van A");
    expect(screen.getByLabelText("Nhãn (tùy chọn)")).toHaveValue("Nhà riêng");
    const checkbox = screen.getByRole("checkbox", { name: "Đặt làm địa chỉ mặc định" });
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
  });

  it("edit mode: submits an update to the given addressId", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(ADDRESS);
    vi.mocked(useCreateAddress).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useUpdateAddress).mockReturnValue({ mutateAsync, isPending: false } as never);
    const nonDefault = { ...ADDRESS, isDefault: false };

    const user = userEvent.setup();
    render(<AddressFormDialog open onOpenChange={vi.fn()} address={nonDefault} />);
    const recipientInput = screen.getByLabelText("Người nhận");
    await user.clear(recipientInput);
    await user.type(recipientInput, "Changed Name");
    await user.click(screen.getByRole("button", { name: "Lưu địa chỉ" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mutateAsync.mock.calls[0]?.[0] as {
      addressId: string;
      payload: Record<string, unknown>;
    };
    expect(arg.addressId).toBe("address-1");
    expect(arg.payload.recipientName).toBe("Changed Name");
  });
});
