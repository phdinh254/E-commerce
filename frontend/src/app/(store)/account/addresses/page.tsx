import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AddressManager } from "@/components/commerce/address-manager";

export const metadata: Metadata = { title: "Sổ địa chỉ" };

export default function AddressesPage() {
  return (
    <>
      <PageHeader
        title="Sổ địa chỉ"
        description="Quản lý địa chỉ nhận hàng và chọn một địa chỉ mặc định cho đơn hàng."
      />
      <div className="mt-8">
        <AddressManager />
      </div>
    </>
  );
}
