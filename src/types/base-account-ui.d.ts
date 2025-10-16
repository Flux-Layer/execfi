declare module "@base-org/account-ui/react" {
  import type { ComponentType } from "react";

  export const SignInWithBaseButton: ComponentType<{
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
    className?: string;
    colorScheme?: string;
    align?: string;
    variant?: string;
    onClick?: () => void;
  }>;
}
