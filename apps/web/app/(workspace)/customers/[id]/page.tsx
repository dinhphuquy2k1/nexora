import { CustomerDetailPage } from "../../../../features/customers/CustomerDetailPage.tsx";
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerDetailPage key={id} id={id} />;
}
