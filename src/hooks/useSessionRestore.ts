import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export interface RestoredSession {
  id: string;
  serverSeedHash: string;
  clientSeed: string;
  nonceBase: number;
  status: string;
  currentRow: number;
  currentMultiplier: number;
  completedRows: number;
  rows: any[];
  wagerWei?: string;
  lockedTileCounts: number[];
}

export function useSessionRestore() {
  const { authenticated, user } = usePrivy();
  const [session, setSession] = useState<RestoredSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function restore() {
      if (!authenticated || !user?.wallet?.address) return;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/degenshoot/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress: user.wallet.address }),
        });
        
        if (!res.ok) {
          throw new Error('Failed to restore session');
        }
        
        const data = await res.json();
        if (data.session) {
          setSession(data.session);
        }
      } catch (err) {
        console.error('[useSessionRestore] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, [authenticated, user?.wallet?.address]);

  return { session, loading, error };
}
