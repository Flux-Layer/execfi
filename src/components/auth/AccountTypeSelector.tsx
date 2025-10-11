'use client';

import React from 'react';
import { SignInWithBaseButton } from '@base-org/account-ui/react';
import { usePrivy } from '@privy-io/react-auth';
import { useBaseAccount } from '@/providers/base-account-provider';

export type AccountType = 'privy' | 'base-account';

interface AccountTypeSelectorProps {
  onSelect?: (type: AccountType) => void;
}

export default function AccountTypeSelector({ onSelect }: AccountTypeSelectorProps) {
  const { login: loginPrivy } = usePrivy();
  const { connect: connectBaseAccount, isInitialized } = useBaseAccount();

  const handlePrivyLogin = async () => {
    await loginPrivy();
    onSelect?.('privy');
  };

  const handleBaseAccountLogin = async () => {
    try {
      await connectBaseAccount();
      onSelect?.('base-account');
    } catch (error: any) {
      console.error('Base Account login failed:', error);
      if (error.message !== 'User rejected connection') {
        alert('Failed to connect Base Account. Please try again.');
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-gray-900 rounded-lg border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-2">
        Choose Your Wallet
      </h2>

      {/* Privy Option */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handlePrivyLogin}
          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
        >
          Sign in with Privy
        </button>
        <p className="text-sm text-gray-400 text-center">
          18 chains • Social login • Email • Phone
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-gray-500 text-sm">OR</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      {/* Base Account Option */}
      <div className="flex flex-col gap-2">
        {isInitialized ? (
          <>
            <SignInWithBaseButton
              colorScheme="dark"
              onClick={handleBaseAccountLogin}
              align="center"
              variant="solid"
            />
            <p className="text-sm text-gray-400 text-center">
              Passkey • Gas sponsorship • Base network
            </p>
          </>
        ) : (
          <div className="text-sm text-gray-500 text-center">
            Loading Base Account...
          </div>
        )}
      </div>
    </div>
  );
}
