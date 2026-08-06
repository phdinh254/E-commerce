import { apiClient } from "@/lib/api/client";
import type { Address, AddressPayload, UpdateAddressPayload } from "@/types/address";

export const addressesApi = {
  async list(signal?: AbortSignal): Promise<Address[]> {
    const response = await apiClient.get<Address[]>("/profile/addresses", { signal });
    return response.data;
  },

  async get(addressId: string, signal?: AbortSignal): Promise<Address> {
    const response = await apiClient.get<Address>(
      `/profile/addresses/${encodeURIComponent(addressId)}`,
      { signal },
    );
    return response.data;
  },

  async create(payload: AddressPayload): Promise<Address> {
    const response = await apiClient.post<Address>("/profile/addresses", payload);
    return response.data;
  },

  async update(addressId: string, payload: UpdateAddressPayload): Promise<Address> {
    const response = await apiClient.patch<Address>(
      `/profile/addresses/${encodeURIComponent(addressId)}`,
      payload,
    );
    return response.data;
  },

  async remove(addressId: string): Promise<void> {
    await apiClient.delete(`/profile/addresses/${encodeURIComponent(addressId)}`);
  },

  /** No body — the target address is entirely determined by the path. */
  async setDefault(addressId: string): Promise<Address> {
    const response = await apiClient.patch<Address>(
      `/profile/addresses/${encodeURIComponent(addressId)}/default`,
    );
    return response.data;
  },
};
