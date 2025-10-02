import { buildMetadata } from "@/lib/seo";
import PrivyAuthPageClient from "./PrivyAuthPageClient";

export const metadata = buildMetadata({
  title: "Sign In",
  description:
    "Access ExecFi with Privy authentication to manage your smart accounts and execute secure onchain transactions.",
  path: "/privy-auth",
  keywords: [
    "ExecFi login",
    "Privy authentication",
    "smart account dashboard",
    "onchain account access",
  ],
});

export default function PrivyAuthPage() {
  return <PrivyAuthPageClient />;
}
