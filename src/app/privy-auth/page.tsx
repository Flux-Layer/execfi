"use client";

import { useLoginWithEmail, usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TextInput from "@components/text-input";
import SplashButton from "@components/splash-button";

export default function Page() {
  const { authenticated, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get all Privy EOA wallets
  const getPrivyWallets = () => {
    if (!wallets || wallets.length === 0) return [];

    console.log({ wallets });

    return wallets.filter((wallet) => wallet.walletClientType === "privy");
  };

  const privyWallets = getPrivyWallets();
  const selectedWallet = privyWallets[selectedWalletIndex] || null;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSendCode = async () => {
    if (!email) return;
    setIsLoading(true);
    try {
      await sendCode({ email });
      setCodeSent(true);
    } catch (error) {
      console.error("Error sending code:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!code) return;
    setIsLoading(true);
    try {
      await loginWithCode({ code });
    } catch (error) {
      console.error("Error logging in:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black" />
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />

      {/* Floating orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/20 rounded-full blur-xl"
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-blue-500/20 rounded-full blur-xl"
        animate={{
          x: [0, -80, 0],
          y: [0, 60, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6">
        {/* Header Section */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="inline-block p-4 mb-6 rounded-2xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-white/10"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </motion.div>
          <h1 className="text-4xl text-white font-bold mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Sign in with your email to access your account
          </p>
        </motion.div>

        {/* Authentication Form */}
        <motion.div
          className="w-full space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {!authenticated ? (
              <motion.div
                key="auth-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Email Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2"
                >
                  <label className="text-sm font-medium text-gray-300 block pl-1">
                    Email Address
                  </label>
                  <TextInput
                    placeholder="Enter your email address"
                    onChangeCallback={(v) => setEmail(v)}
                    withActionButton
                    actionButtonCaption={isLoading ? "Sending..." : "Send Code"}
                    actionButtonCallback={handleSendCode}
                  />
                </motion.div>

                {/* Code Input - Animated entry */}
                <AnimatePresence>
                  {codeSent && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -20 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -20 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-300 block pl-1">
                          Verification Code
                        </label>
                        <motion.div
                          className="w-2 h-2 bg-green-500 rounded-full"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2 }}
                        />
                      </div>
                      <TextInput
                        placeholder="Enter the 6-digit code"
                        onChangeCallback={(v) => setCode(v)}
                        withActionButton
                        actionButtonCaption={
                          isLoading ? "Signing in..." : "Sign In"
                        }
                        actionButtonCallback={handleLogin}
                      />
                      <motion.p
                        className="text-sm text-gray-500 pl-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        Check your email for the verification code
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="authenticated"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-6"
              >
                {/* Success Status */}
                <motion.div
                  className="flex items-center justify-center gap-3 mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 font-medium">
                    Successfully signed in
                  </span>
                </motion.div>

                {/* Wallet Information Card */}
                <motion.div
                  className="bg-gradient-to-br from-white/5 to-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">EOA Wallet</h3>
                        <p className="text-gray-400 text-sm">
                          Externally Owned Account
                        </p>
                      </div>
                    </div>

                    {/* User Email */}
                    {user?.email && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Email
                        </label>
                        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                            />
                          </svg>
                          <span className="text-white text-sm font-mono">
                            {user.email.address}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Wallet Selector Dropdown */}
                    {privyWallets.length > 1 && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Select Wallet ({privyWallets.length} available)
                        </label>
                        <div className="relative" ref={dropdownRef}>
                          {/* Dropdown Button */}
                          <motion.button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-full p-3 bg-black/20 border border-white/10 rounded-lg hover:border-white/20 transition-all duration-200 text-left"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 bg-purple-500 rounded-full" />
                              <div className="flex-1">
                                <div className="text-white text-sm font-mono">
                                  {formatAddress(selectedWallet?.address || '')}
                                </div>
                                <div className="text-gray-400 text-xs">
                                  Wallet #{selectedWalletIndex + 1}
                                </div>
                              </div>
                              <motion.svg
                                className="w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </motion.svg>
                            </div>
                          </motion.button>

                          {/* Dropdown Menu */}
                          <AnimatePresence>
                            {isDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-2xl z-10 overflow-hidden"
                              >
                                {privyWallets.map((wallet, index) => (
                                  <motion.button
                                    key={wallet.address}
                                    onClick={() => {
                                      setSelectedWalletIndex(index);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`w-full p-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0 ${
                                      selectedWalletIndex === index ? 'bg-purple-500/20' : ''
                                    }`}
                                    whileHover={{ x: 4 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${
                                        selectedWalletIndex === index ? 'bg-purple-500' : 'bg-gray-600'
                                      }`} />
                                      <div className="flex-1">
                                        <div className="text-white text-sm font-mono">
                                          {formatAddress(wallet.address)}
                                        </div>
                                        <div className="text-gray-400 text-xs">
                                          Wallet #{index + 1}
                                        </div>
                                      </div>
                                      {selectedWalletIndex === index && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="text-purple-400"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </motion.div>
                                      )}
                                    </div>
                                  </motion.button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    {/* Wallet Address */}
                    {selectedWallet?.address && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Privy EOA Address
                        </label>
                        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          <span className="text-white text-sm font-mono flex-1">
                            {formatAddress(selectedWallet.address)}
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard(selectedWallet.address)
                            }
                            className="p-1.5 hover:bg-white/10 rounded-md transition-colors group"
                            title="Copy address"
                          >
                            {copiedAddress ? (
                              <motion.svg
                                className="w-4 h-4 text-green-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 30,
                                }}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </motion.svg>
                            ) : (
                              <svg
                                className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Wallet Type */}
                    {selectedWallet?.walletClientType && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Wallet Type
                        </label>
                        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <span className="text-white text-sm capitalize">
                            {selectedWallet.walletClientType}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Connection Method */}
                    {selectedWallet?.connectorType && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Connection Method
                        </label>
                        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                          <span className="text-white text-sm capitalize">
                            {selectedWallet.connectorType}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Created At */}
                    {user?.createdAt && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Account Created
                        </label>
                        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="text-white text-sm">
                            {new Date(user.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  className="flex flex-col gap-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <SplashButton caption="Sign Out" callback={() => logout()} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-sm text-gray-500">
            Secure authentication powered by{" "}
            <span className="text-purple-400 font-medium">Privy</span>
          </p>
        </motion.div>
      </div>
    </main>
  );
}
