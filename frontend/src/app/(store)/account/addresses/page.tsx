import type { Metadata } from "next";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { PageHeader } from "@/components/layout/page-header";
import { AddressManager } from "@/components/commerce/address-manager";

export const metadata: Metadata = { title: "S? ??a ch?" };
export default async function AddressesPage() { const addresses = await commerceRepository.getAddresses(); return <><PageHeader title="S? ??a ch?" description="Qu?n l? ??a ch? nh?n h?ng. Ch? m?t ??a ch? ?ang ho?t ??ng ???c ??t l?m m?c ??nh." /><div className="mt-8"><AddressManager initialAddresses={addresses} /></div></>; }
