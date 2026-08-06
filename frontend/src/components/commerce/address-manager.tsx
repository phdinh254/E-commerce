"use client";

import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { AddressFormDialog } from "@/components/commerce/address-form-dialog";
import { useAddresses } from "@/lib/hooks/use-addresses";
import { useDeleteAddress } from "@/lib/hooks/use-delete-address";
import { useSetDefaultAddress } from "@/lib/hooks/use-set-default-address";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Address } from "@/types/address";

export function AddressManager() {
  const { data: addresses, isLoading, isError, error, refetch } = useAddresses();
  const deleteAddress = useDeleteAddress();
  const setDefaultAddress = useSetDefaultAddress();
  const [formState, setFormState] = useState<{ open: boolean; address?: Address }>({
    open: false,
  });

  function openCreate() {
    setFormState({ open: true, address: undefined });
  }

  function openEdit(address: Address) {
    setFormState({ open: true, address });
  }

  async function handleSetDefault(addressId: string) {
    try {
      await setDefaultAddress.mutateAsync(addressId);
      toast.success("Đã đặt làm địa chỉ mặc định.");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-center">
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {addresses && addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Bạn chưa có địa chỉ nào được lưu.</p>
        </div>
      ) : null}

      {addresses?.map((address) => (
        <article key={address.id} className="rounded-2xl border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <MapPin className="size-5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">
                    {address.label ? `${address.label} · ` : ""}
                    {address.recipientName}
                  </h2>
                  {address.isDefault ? (
                    <span className="rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">
                      Mặc định
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{address.phoneNumber}</p>
                <p className="mt-2 max-w-xl text-sm leading-6">
                  {address.streetAddress}, {address.ward}, {address.district}, {address.province}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-13 sm:pl-0">
              {!address.isDefault ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={setDefaultAddress.isPending}
                  onClick={() => handleSetDefault(address.id)}
                >
                  Đặt làm mặc định
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => openEdit(address)}>
                Chỉnh sửa
              </Button>
              <ConfirmDialog
                triggerLabel="Xóa"
                title="Xóa địa chỉ này?"
                description="Địa chỉ sẽ không còn khả dụng cho lần thanh toán tiếp theo."
                confirmLabel="Xóa địa chỉ"
                destructive
                showDefaultSuccessToast={false}
                onConfirm={async () => {
                  try {
                    await deleteAddress.mutateAsync(address.id);
                    toast.success("Đã xóa địa chỉ.");
                  } catch (error) {
                    toast.error(getApiErrorMessage(error));
                    throw error;
                  }
                }}
              />
            </div>
          </div>
        </article>
      ))}

      <Button variant="outline" size="lg" onClick={openCreate}>
        <Plus aria-hidden="true" />
        Thêm địa chỉ
      </Button>

      <AddressFormDialog
        open={formState.open}
        onOpenChange={(open) => setFormState((current) => ({ ...current, open }))}
        address={formState.address}
      />
    </div>
  );
}
