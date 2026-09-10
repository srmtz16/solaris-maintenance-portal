import { AdminPortal } from "@/components/admin-portal";

export default async function AdminClientSystemPage({ params }: { params: Promise<{ systemCode: string }> }) {
  const { systemCode } = await params;
  return <AdminPortal view="clientes" systemCode={systemCode} />;
}
