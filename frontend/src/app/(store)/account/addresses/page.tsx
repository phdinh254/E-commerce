import type { Metadata } from "next";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { PageHeader } from "@/components/layout/page-header";
import { AddressManager } from "@/components/commerce/address-manager";

export const metadata: Metadata = { title: "Sổ địa chỉ" };
export default async function AddressesPage() { const addresses = await commerceRepository.getAddresses(); return <><PageHeader title="Sổ địa chỉ" description="Quản lý địa chỉ nhận hàng và chọn một địa chỉ mặc định cho đơn hàng." /><div className="mt-8"><AddressManager initialAddresses={addresses} /></div></>; }
