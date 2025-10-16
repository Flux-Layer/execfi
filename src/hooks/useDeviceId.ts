/**
 * React hook for device ID management
 * Provides device identification without requiring wallet authentication
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getOrCreateDeviceId, clearStoredDeviceData } from '@/lib/device/fingerprint';

interface UseDeviceIdReturn {
  deviceId: string | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  clearDevice: () => void;
}

/**
 * Hook to get or create device ID
 * Automatically initializes on mount
 *
 * @returns {UseDeviceIdReturn} Device ID state and methods
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { deviceId, loading, error } = useDeviceId();
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <Error />;
 *
 *   return <div>Device ID: {deviceId}</div>;
 * }
 * ```
 */
export function useDeviceId(): UseDeviceIdReturn {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDeviceId = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const id = await getOrCreateDeviceId();
      setDeviceId(id);
    } catch (err) {
      console.error('Error fetching device ID:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  const clearDevice = useCallback(() => {
    clearStoredDeviceData();
    setDeviceId(null);
    fetchDeviceId();
  }, [fetchDeviceId]);

  useEffect(() => {
    fetchDeviceId();
  }, [fetchDeviceId]);

  return {
    deviceId,
    loading,
    error,
    refetch: fetchDeviceId,
    clearDevice,
  };
}
