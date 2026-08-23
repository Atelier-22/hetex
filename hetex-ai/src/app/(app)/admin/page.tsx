import { notFound } from "next/navigation";
import { serverApiFetch } from "@/lib/api-server";
import { AdminDashboard } from "@/components/admin/dashboard";

/**
 * Admin only. The check runs on the server so a non-admin never receives the
 * page at all, and the API returns 404 rather than 403 for the same reason —
 * there is no point advertising that an admin surface exists here.
 */
export default async function AdminPage() {
  const me = await serverApiFetch<{ isAdmin: boolean }>("/admin/me");
  if (!me?.isAdmin) return notFound();

  return <AdminDashboard />;
}
