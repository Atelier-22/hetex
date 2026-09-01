import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-server";
import { AdminDashboard } from "@/components/admin/dashboard";
import type { Overview, AdminUser } from "@/components/admin/dashboard";

export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * Data is fetched here, on the server, with the admin cookie — so the token
 * never reaches the browser and the page has no dependency on the chat app's
 * session. No cookie, or a rejected one, means sign in again; there is no
 * silent 404 to puzzle over.
 */
export default async function AdminPage() {
  const [overview, users] = await Promise.all([
    adminFetch<Overview>("/admin/overview"),
    adminFetch<AdminUser[]>("/admin/users?limit=25"),
  ]);

  if (!overview || !users) redirect("/admin/login");

  return <AdminDashboard overview={overview} users={users} />;
}
