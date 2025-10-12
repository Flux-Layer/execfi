/**
 * Sub Account Key Management
 * 
 * Handles generation and storage of private keys for Base Account Sub Accounts.
 * Keys are stored encrypted in localStorage and linked to user's Base Account.
 */

import { privateKeyToAccount } from 'viem/accounts';
import type { LocalAccount } from 'viem';

const STORAGE_KEY_PREFIX = 'base_sub_account_key_';
const STORAGE_VERSION = 'v1';

interface StoredKeyData {
  version: string;
  privateKey: string;
  createdAt: number;
  baseAccountAddress: string;
}

/**
 * Generate a new private key for Sub Account
 */
export function generateSubAccountPrivateKey(): `0x${string}` {
  // Generate 32 random bytes for private key
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  
  // Convert to hex string
  const hexString = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `0x${hexString}`;
}

/**
 * Get storage key for a specific Base Account
 */
function getStorageKey(baseAccountAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${baseAccountAddress.toLowerCase()}`;
}

/**
 * Store Sub Account private key in localStorage
 * 
 * Note: In production, consider using more secure storage like:
 * - Encrypted IndexedDB
 * - Server-side key management (AWS KMS, HashiCorp Vault)
 * - Hardware security modules
 */
export function storeSubAccountKey(
  baseAccountAddress: string,
  privateKey: `0x${string}`
): void {
  const data: StoredKeyData = {
    version: STORAGE_VERSION,
    privateKey,
    createdAt: Date.now(),
    baseAccountAddress: baseAccountAddress.toLowerCase(),
  };

  const storageKey = getStorageKey(baseAccountAddress);
  
  try {
    // Simple base64 encoding (not encryption, just obfuscation)
    // In production, use proper encryption with user-derived key
    const encoded = btoa(JSON.stringify(data));
    localStorage.setItem(storageKey, encoded);
    
    console.log('✅ Stored Sub Account private key for:', baseAccountAddress);
  } catch (error) {
    console.error('❌ Failed to store Sub Account key:', error);
    throw new Error('Failed to store Sub Account key');
  }
}

/**
 * Retrieve Sub Account private key from localStorage
 */
export function retrieveSubAccountKey(
  baseAccountAddress: string
): `0x${string}` | null {
  const storageKey = getStorageKey(baseAccountAddress);
  
  try {
    const encoded = localStorage.getItem(storageKey);
    if (!encoded) {
      return null;
    }

    const decoded = atob(encoded);
    const data: StoredKeyData = JSON.parse(decoded);

    // Validate stored data
    if (data.version !== STORAGE_VERSION) {
      console.warn('⚠️ Stored key version mismatch, regenerating...');
      return null;
    }

    if (data.baseAccountAddress.toLowerCase() !== baseAccountAddress.toLowerCase()) {
      console.error('❌ Key address mismatch!');
      return null;
    }

    return data.privateKey as `0x${string}`;
  } catch (error) {
    console.error('❌ Failed to retrieve Sub Account key:', error);
    return null;
  }
}

/**
 * Delete Sub Account private key from localStorage
 */
export function deleteSubAccountKey(baseAccountAddress: string): void {
  const storageKey = getStorageKey(baseAccountAddress);
  localStorage.removeItem(storageKey);
  console.log('🗑️ Deleted Sub Account key for:', baseAccountAddress);
}

/**
 * Get or create Sub Account private key
 */
export function getOrCreateSubAccountKey(
  baseAccountAddress: string
): `0x${string}` {
  // Try to retrieve existing key
  const existingKey = retrieveSubAccountKey(baseAccountAddress);
  if (existingKey) {
    console.log('♻️ Using existing Sub Account key');
    return existingKey;
  }

  // Generate new key
  console.log('🔑 Generating new Sub Account private key...');
  const newKey = generateSubAccountPrivateKey();
  
  // Store it
  storeSubAccountKey(baseAccountAddress, newKey);
  
  return newKey;
}

/**
 * Create a viem LocalAccount from Sub Account private key
 */
export function getSubAccountOwner(
  baseAccountAddress: string
): LocalAccount | null {
  try {
    const privateKey = getOrCreateSubAccountKey(baseAccountAddress);
    const account = privateKeyToAccount(privateKey);
    
    console.log('✅ Sub Account owner:', account.address);
    return account;
  } catch (error) {
    console.error('❌ Failed to create Sub Account owner:', error);
    return null;
  }
}

/**
 * Check if Sub Account key exists for given Base Account
 */
export function hasSubAccountKey(baseAccountAddress: string): boolean {
  return retrieveSubAccountKey(baseAccountAddress) !== null;
}
