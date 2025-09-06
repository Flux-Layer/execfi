'use client'

import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function QCProvider(props: React.PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      {props?.children}
    </QueryClientProvider>
  );
}
