import { usePrivy } from '@privy-io/react-auth';
import { useCallback } from 'react';

export function useLogoutHandler() {
  const { user, logout: privyLogout } = usePrivy();

  const logout = useCallback(async () => {
    if (user?.wallet?.address) {
      try {
        await fetch('/api/degenshoot/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress: user.wallet.address }),
        });
      } catch (error) {
        console.error('[useLogoutHandler] Failed to clear sessions:', error);
      }
    }
    await privyLogout();
  }, [user?.wallet?.address, privyLogout]);

  return { logout };
}
