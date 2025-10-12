/**
 * Utility to get the active wallet address based on account mode
 */

import type { CoreContext } from '../state/types';

export interface ActiveWallet {
  address: `0x${string}` | null;
  mode: 'EOA' | 'SMART_ACCOUNT' | 'BASE_ACCOUNT';
  label: string;
}

/**
 * Get the active wallet address based on the current account mode
 */
export function getActiveWalletAddress(core: CoreContext): `0x${string}` | null {
  const accountMode = core.accountMode || "EOA";

  switch (accountMode) {
    case "BASE_ACCOUNT":
      return core.baseAccountClients?.address || null;
    
    case "SMART_ACCOUNT":
      return core.saAddress || null;
    
    case "EOA":
    default:
      return (core.selectedWallet?.address as `0x${string}`) || null;
  }
}

/**
 * Get active wallet info including address, mode, and label
 */
export function getActiveWallet(core: CoreContext): ActiveWallet {
  const accountMode = core.accountMode || "EOA";
  const address = getActiveWalletAddress(core);

  const labels = {
    'EOA': 'EOA Wallet',
    'SMART_ACCOUNT': 'Smart Account',
    'BASE_ACCOUNT': 'Base Account (Passkey)',
  };

  return {
    address,
    mode: accountMode,
    label: labels[accountMode],
  };
}

/**
 * Check if any wallet is available
 */
export function hasAnyWallet(core: CoreContext): boolean {
  return !!(
    core.selectedWallet?.address ||
    core.saAddress ||
    core.baseAccountClients?.address
  );
}

/**
 * Get all available wallet addresses
 */
export function getAllWalletAddresses(core: CoreContext): Array<{
  address: `0x${string}`;
  mode: 'EOA' | 'SMART_ACCOUNT' | 'BASE_ACCOUNT';
  label: string;
  isActive: boolean;
}> {
  const accountMode = core.accountMode || "EOA";
  const wallets: Array<{
    address: `0x${string}`;
    mode: 'EOA' | 'SMART_ACCOUNT' | 'BASE_ACCOUNT';
    label: string;
    isActive: boolean;
  }> = [];

  if (core.selectedWallet?.address) {
    wallets.push({
      address: core.selectedWallet.address as `0x${string}`,
      mode: 'EOA',
      label: 'EOA Wallet',
      isActive: accountMode === 'EOA',
    });
  }

  if (core.saAddress) {
    wallets.push({
      address: core.saAddress,
      mode: 'SMART_ACCOUNT',
      label: 'Smart Account',
      isActive: accountMode === 'SMART_ACCOUNT',
    });
  }

  if (core.baseAccountClients?.address) {
    wallets.push({
      address: core.baseAccountClients.address,
      mode: 'BASE_ACCOUNT',
      label: 'Base Account (Passkey)',
      isActive: accountMode === 'BASE_ACCOUNT',
    });
  }

  return wallets;
}
