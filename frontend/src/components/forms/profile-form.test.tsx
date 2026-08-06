import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useProfile } from "@/lib/hooks/use-profile";
import { useUpdateProfile } from "@/lib/hooks/use-update-profile";
import { ProfileForm } from "./profile-form";
import type { User } from "@/types/commerce";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/hooks/use-profile", () => ({ useProfile: vi.fn() }));
vi.mock("@/lib/hooks/use-update-profile", () => ({ useUpdateProfile: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

const PROFILE: User = { id: "u1", email: "user@example.com", fullName: "Nguyen Van A", role: "CUSTOMER", status: "ACTIVE" };

describe("ProfileForm", () => {
  it("shows a loading state", () => {
    vi.mocked(useProfile).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useUpdateProfile).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<ProfileForm />);

    expect(screen.queryByLabelText("Họ và tên")).not.toBeInTheDocument();
  });

  it("shows a retry action on error", async () => {
    const refetch = vi.fn();
    vi.mocked(useProfile).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network down"),
      refetch,
    } as never);
    vi.mocked(useUpdateProfile).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    const user = userEvent.setup();
    render(<ProfileForm />);
    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders fullName editable and email read-only", () => {
    vi.mocked(useProfile).mockReturnValue({
      data: PROFILE,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useUpdateProfile).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<ProfileForm />);

    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyen Van A");
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Email")).toHaveValue("user@example.com");
  });

  it("submits only fullName, never email/role/status", async () => {
    vi.mocked(useProfile).mockReturnValue({
      data: PROFILE,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    const mutateAsync = vi.fn().mockResolvedValue({ ...PROFILE, fullName: "New Name" });
    vi.mocked(useUpdateProfile).mockReturnValue({ mutateAsync, isPending: false } as never);

    const user = userEvent.setup();
    render(<ProfileForm />);
    const input = screen.getByLabelText("Họ và tên");
    await user.clear(input);
    await user.type(input, "New Name");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith("New Name"));
  });

  it("disables submit until the form is dirty", () => {
    vi.mocked(useProfile).mockReturnValue({
      data: PROFILE,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useUpdateProfile).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<ProfileForm />);

    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  });
});
