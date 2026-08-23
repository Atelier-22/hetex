import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Landing } from "@/components/marketing/landing";

export default async function RootPage() {
  // Signed-in visitors have no use for the pitch — send them to the product.
  const session = await getServerSession(authOptions);
  if (session) redirect("/chat");

  return <Landing />;
}
