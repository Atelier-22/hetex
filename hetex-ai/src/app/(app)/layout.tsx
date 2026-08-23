import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SettingsOverlay } from "@/components/settings";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    // h-dvh, not h-screen: on a phone 100vh includes the space under the
    // browser's address bar, so the composer sits below the fold until the bar
    // hides. dvh tracks the actually-visible height.
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
      <SettingsOverlay />
    </div>
  );
}
