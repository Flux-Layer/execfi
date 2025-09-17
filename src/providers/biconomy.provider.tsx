"use client";
import { PropsWithChildren } from "react";

// AbstractJS doesn't require a provider wrapper
// The client is created directly in the useBiconomySA hook
export default function BProvider(props: PropsWithChildren) {
  // No longer needed with AbstractJS - just pass through children
  return <>{props?.children}</>;
}
