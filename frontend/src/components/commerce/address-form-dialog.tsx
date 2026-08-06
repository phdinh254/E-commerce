"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateAddress } from "@/lib/hooks/use-create-address";
import { useUpdateAddress } from "@/lib/hooks/use-update-address";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Address } from "@/types/address";

const PHONE_PATTERN = /^(0|\+84)[0-9]{9,10}$/;

const addressSchema = z.object({
  label: z.string().trim().max(100, "Nhãn không được vượt quá 100 ký tự.").optional(),
  recipientName: z.string().trim().min(1, "Vui lòng nhập tên người nhận.").max(255),
  phoneNumber: z.string().trim().regex(PHONE_PATTERN, "Số điện thoại không hợp lệ."),
  province: z.string().trim().min(1, "Vui lòng nhập tỉnh hoặc thành phố.").max(255),
  district: z.string().trim().min(1, "Vui lòng nhập quận hoặc huyện.").max(255),
  ward: z.string().trim().min(1, "Vui lòng nhập phường hoặc xã.").max(255),
  streetAddress: z.string().trim().min(1, "Vui lòng nhập địa chỉ chi tiết.").max(255),
  makeDefault: z.boolean(),
});
type AddressFormValues = z.infer<typeof addressSchema>;

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

function emptyValues(): AddressFormValues {
  return {
    label: "",
    recipientName: "",
    phoneNumber: "",
    province: "",
    district: "",
    ward: "",
    streetAddress: "",
    makeDefault: false,
  };
}

function valuesFromAddress(address: Address): AddressFormValues {
  return {
    label: address.label ?? "",
    recipientName: address.recipientName,
    phoneNumber: address.phoneNumber,
    province: address.province,
    district: address.district,
    ward: address.ward,
    streetAddress: address.streetAddress,
    makeDefault: address.isDefault,
  };
}

/**
 * One component for both create and edit — `address` present means edit.
 * `makeDefault` is local form state, never sent as `isDefault: false`: the
 * backend rejects that explicitly (unsetting a default requires nominating
 * a replacement via setDefault on a different address instead), so the
 * checkbox for an already-default address is checked and disabled, and for
 * everything else the payload only ever carries `isDefault: true` or omits
 * the field entirely.
 */
export function AddressFormDialog({
  open,
  onOpenChange,
  address,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: Address;
}) {
  const isEdit = Boolean(address);
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const isPending = createAddress.isPending || updateAddress.isPending;

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (open) {
      form.reset(address ? valuesFromAddress(address) : emptyValues());
    }
  }, [open, address, form]);

  const submit = form.handleSubmit(async (values) => {
    const payload = {
      label: values.label || undefined,
      recipientName: values.recipientName,
      phoneNumber: values.phoneNumber,
      province: values.province,
      district: values.district,
      ward: values.ward,
      streetAddress: values.streetAddress,
      isDefault: values.makeDefault ? true : undefined,
    };

    try {
      if (address) {
        await updateAddress.mutateAsync({ addressId: address.id, payload });
        toast.success("Đã cập nhật địa chỉ.");
      } else {
        await createAddress.mutateAsync(payload);
        toast.success("Đã thêm địa chỉ mới.");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa địa chỉ" : "Địa chỉ mới"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="address-label">Nhãn (tùy chọn)</Label>
            <Input id="address-label" placeholder="Nhà riêng, Công ty..." {...form.register("label")} />
            <FieldError message={form.formState.errors.label?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address-recipient">Người nhận</Label>
              <Input
                id="address-recipient"
                autoComplete="name"
                aria-invalid={Boolean(form.formState.errors.recipientName)}
                {...form.register("recipientName")}
              />
              <FieldError message={form.formState.errors.recipientName?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-phone">Số điện thoại</Label>
              <Input
                id="address-phone"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={Boolean(form.formState.errors.phoneNumber)}
                {...form.register("phoneNumber")}
              />
              <FieldError message={form.formState.errors.phoneNumber?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-province">Tỉnh hoặc thành phố</Label>
              <Input
                id="address-province"
                autoComplete="address-level1"
                {...form.register("province")}
              />
              <FieldError message={form.formState.errors.province?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-district">Quận hoặc huyện</Label>
              <Input
                id="address-district"
                autoComplete="address-level2"
                {...form.register("district")}
              />
              <FieldError message={form.formState.errors.district?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-ward">Phường hoặc xã</Label>
              <Input id="address-ward" {...form.register("ward")} />
              <FieldError message={form.formState.errors.ward?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-street">Địa chỉ chi tiết</Label>
              <Input
                id="address-street"
                autoComplete="street-address"
                {...form.register("streetAddress")}
              />
              <FieldError message={form.formState.errors.streetAddress?.message} />
            </div>
          </div>
          <Controller
            control={form.control}
            name="makeDefault"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={address?.isDefault}
                />
                Đặt làm địa chỉ mặc định
              </label>
            )}
          />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Hủy</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Đang lưu..." : "Lưu địa chỉ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
