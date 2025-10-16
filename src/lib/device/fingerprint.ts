/**
 * Device fingerprinting service using FingerprintJS
 * Provides device identification without requiring wallet authentication
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import type { DeviceFingerprint, DeviceMetadata, StoredDeviceData } from './types';

// Storage keys
const STORAGE_KEY_DEVICE_ID = 'deviceId';
const STORAGE_KEY_FINGERPRINT = 'deviceFingerprint';

// In-memory cache for the current session
let fingerprintCache: string | null = null;
let fpAgent: any = null;

/**
 * Initialize FingerprintJS agent (lazy initialization)
 */
async function getFingerprintAgent() {
  if (fpAgent) return fpAgent;
  fpAgent = await FingerprintJS.load();
  return fpAgent;
}

/**
 * Generate device fingerprint using FingerprintJS
 * @returns {Promise<string>} Unique device fingerprint
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    // Return cached fingerprint if available
    if (fingerprintCache) {
      return fingerprintCache;
    }

    // Generate new fingerprint
    const agent = await getFingerprintAgent();
    const result = await agent.get();

    const fingerprint = result.visitorId;

    // Cache in memory for this session
    fingerprintCache = fingerprint;

    return fingerprint;
  } catch (error) {
    console.error('Error generating fingerprint:', error);
    // Fallback to UUID if fingerprint fails
    return generateFallbackId();
  }
}

/**
 * Get device metadata for tracking
 * @returns {DeviceMetadata} Device metadata object
 */
export function getDeviceMetadata(): DeviceMetadata {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    userAgent: navigator.userAgent,
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    platform: navigator.platform,
  };
}

/**
 * Get stored device ID from localStorage
 * @returns {string | null} Stored device ID or null
 */
export function getStoredDeviceId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(STORAGE_KEY_DEVICE_ID);
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
}

/**
 * Store device ID in localStorage
 * @param {string} id - Device ID to store
 */
export function setStoredDeviceId(id: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, id);
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
}

/**
 * Get stored fingerprint from localStorage
 * @returns {string | null} Stored fingerprint or null
 */
export function getStoredFingerprint(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(STORAGE_KEY_FINGERPRINT);
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
}

/**
 * Store fingerprint in localStorage
 * @param {string} fingerprint - Fingerprint to store
 */
export function setStoredFingerprint(fingerprint: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY_FINGERPRINT, fingerprint);
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
}

/**
 * Generate fallback UUID when fingerprint fails
 * @returns {string} UUID v4
 */
function generateFallbackId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get or create device ID with fingerprint
 * This is the main function to use for device identification
 *
 * Priority:
 * 1. Stored deviceId from localStorage (if exists)
 * 2. Generate new fingerprint and store it
 * 3. Fallback to UUID if fingerprint fails
 *
 * @returns {Promise<string>} Device ID (fingerprint or fallback UUID)
 */
export async function getOrCreateDeviceId(): Promise<string> {
  // 1. Check localStorage for existing deviceId
  const storedId = getStoredDeviceId();
  if (storedId) {
    return storedId;
  }

  // 2. Try to get stored fingerprint
  const storedFingerprint = getStoredFingerprint();
  if (storedFingerprint) {
    setStoredDeviceId(storedFingerprint);
    return storedFingerprint;
  }

  // 3. Generate new fingerprint
  try {
    const fingerprint = await getDeviceFingerprint();

    // Store both deviceId and fingerprint
    setStoredDeviceId(fingerprint);
    setStoredFingerprint(fingerprint);

    return fingerprint;
  } catch (error) {
    console.error('Failed to generate fingerprint:', error);

    // 4. Fallback to UUID
    const fallbackId = generateFallbackId();
    setStoredDeviceId(fallbackId);

    return fallbackId;
  }
}

/**
 * Clear stored device data (for testing or user reset)
 */
export function clearStoredDeviceData(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY_DEVICE_ID);
    localStorage.removeItem(STORAGE_KEY_FINGERPRINT);
    fingerprintCache = null;
  } catch (error) {
    console.error('Error clearing device data:', error);
  }
}
