import { buildMetadata } from "@/lib/seo";
import HomePageClient from "./HomePageClient";

export const metadata = buildMetadata({ path: "/" });

export default function Home() {
  return <HomePageClient />;
}
