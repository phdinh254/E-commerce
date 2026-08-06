// Mirrors, field-for-field, backend/src/modules/addresses/dto/*.dto.ts — no
// invented fields, no client-side ownership/id/timestamp source of truth.

export interface Address {
  id: string;
  label: string | null;
  recipientName: string;
  phoneNumber: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Never carries id/userId/createdAt/updatedAt — owner and identity are
 * always server-assigned. */
export interface AddressPayload {
  label?: string;
  recipientName: string;
  phoneNumber: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
  /** May only be sent as `true` on update (the backend rejects `false` —
   * unsetting the default without nominating a replacement is invalid; use
   * `addressesApi.setDefault` on a different address instead). */
  isDefault?: boolean;
}

export type UpdateAddressPayload = Partial<AddressPayload>;
