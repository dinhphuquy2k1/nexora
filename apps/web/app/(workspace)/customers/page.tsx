import { Suspense } from "react";
import { CustomerListPage } from "../../../features/customers/CustomerListPage.tsx";
export default function CustomersPage() {
  return (
    <Suspense fallback={<p>Đang tải bộ lọc…</p>}>
      <CustomerListPage />
    </Suspense>
  );
}
