"use client";

import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TextInput from "@components/text-input";
import SplashButton from "@components/splash-button";
import { useEOA } from "@hooks/useEOA";
import useSmartWallet from "@/hooks/useSmartWallet";
import SmartAccountBalance from "@/components/SmartAccountBalance";

export default function PrivyAuthPageClient() {
  const { authenticated, logout, user, exportWallet } = usePrivy();
  const {
    privyWallets,
    selectedWallet,
    selectedWalletIndex,
    setSelectedWalletIndex,
    formatAddress,
    copyAddress,
    copiedAddress,
  } = useEOA();

  const {
    smartWallets,
    selectedSmartWallet,
    selectedSmartWalletIndex,
    setSelectedSmartWalletIndex,
    smartWallet,
    smartWalletClient,
    smartAccountAddress,
    isReady: smartWalletReady,
    hasMultipleSmartWallets,
    formatSmartWalletAddress,
    copySmartWalletAddress,
  } = useSmartWallet();

  useEffect(() => {
    console.log({ smartWallets });
  }, [smartWallets]);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSmartWalletDropdownOpen, setIsSmartWalletDropdownOpen] =
    useState(false);
  const [smartAccountCopied, setSmartAccountCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const smartWalletDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        smartWalletDropdownRef.current &&
        !smartWalletDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSmartWalletDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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

  const copySmartAccountAddress = async () => {
    if (!smartAccountAddress) return;
    const success = await copySmartWalletAddress(smartAccountAddress);
    if (success) {
      setSmartAccountCopied(true);
      setTimeout(() => setSmartAccountCopied(false), 2000);
    }
  };

  // Smart Wallet <-> EOA synchronization logic
  const handleSmartWalletSelectionChange = (index: number) => {
    setSelectedSmartWalletIndex(index);
    setIsSmartWalletDropdownOpen(false);

    // Sync EOA selection based on Smart Wallet selection
    // For a 1:1 mapping, we can match indices
    // In a more complex scenario, you'd match based on some relationship
    if (index < privyWallets.length) {
      setSelectedWalletIndex(index);
    }
  };

  const handleEOASelectionChange = (index: number) => {
    setSelectedWalletIndex(index);

    // Sync Smart Wallet selection based on EOA selection
    if (index < smartWallets.length) {
      setSelectedSmartWalletIndex(index);
    }
  };

  return (
    <main className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-x-hidden py-8">
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

      <div className="relative z-10 flex flex-col items-center max-w-7xl w-full px-6">
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
                  <label className="text-sm font-medium text-gray-300 block px-4">
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
                        <label className="text-sm font-medium text-gray-300 block px-4">
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
                        className="text-sm text-gray-500 px-4"
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

                {/* Account Cards Container */}
                <div className="w-full space-y-6">
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
                          <h3 className="text-white font-semibold">
                            EOA Wallet
                          </h3>
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
                                    {formatAddress(
                                      selectedWallet?.address || "",
                                    )}
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
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
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
                                      onClick={() =>
                                        handleEOASelectionChange(index)
                                      }
                                      className={`w-full p-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0 ${
                                        selectedWalletIndex === index
                                          ? "bg-purple-500/20"
                                          : ""
                                      }`}
                                      whileHover={{ x: 4 }}
                                      transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 30,
                                      }}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={`w-2 h-2 rounded-full ${
                                            selectedWalletIndex === index
                                              ? "bg-purple-500"
                                              : "bg-gray-600"
                                          }`}
                                        />
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
                                            <svg
                                              className="w-3 h-3"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M5 13l4 4L19 7"
                                              />
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
                                copyAddress(selectedWallet.address)
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

                      {/* Export Wallet Button */}
                      {selectedWallet?.address && (
                        <div className="pt-2">
                          <button
                            onClick={() =>
                              exportWallet({ address: selectedWallet.address })
                            }
                            className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all font-medium text-sm flex items-center justify-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            Export Private Key
                          </button>
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

                  {/* Smart Account Information Card */}
                  <motion.div
                    className="bg-gradient-to-br from-purple-500/5 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6 backdrop-blur-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
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
                              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">
                            Smart Account
                          </h3>
                          <p className="text-gray-400 text-sm">
                            ERC-4337 Account Abstraction
                          </p>
                        </div>
                      </div>

                      {/* Smart Wallet Selector Dropdown */}
                      {hasMultipleSmartWallets && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            Select Smart Account ({smartWallets.length}{" "}
                            available)
                          </label>
                          <div
                            className="relative"
                            ref={smartWalletDropdownRef}
                          >
                            {/* Dropdown Button */}
                            <motion.button
                              onClick={() =>
                                setIsSmartWalletDropdownOpen(
                                  !isSmartWalletDropdownOpen,
                                )
                              }
                              className="w-full p-3 bg-black/20 border border-white/10 rounded-lg hover:border-purple-500/20 transition-all duration-200 text-left"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-purple-500 rounded-full" />
                                <div className="flex-1">
                                  <div className="text-white text-sm font-mono">
                                    {formatSmartWalletAddress(
                                      selectedSmartWallet?.address,
                                    )}
                                  </div>
                                  <div className="text-gray-400 text-xs">
                                    Smart Account #
                                    {selectedSmartWalletIndex + 1}
                                  </div>
                                </div>
                                <motion.svg
                                  className="w-4 h-4 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  animate={{
                                    rotate: isSmartWalletDropdownOpen ? 180 : 0,
                                  }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </motion.svg>
                              </div>
                            </motion.button>

                            {/* Dropdown Menu */}
                            <AnimatePresence>
                              {isSmartWalletDropdownOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                  transition={{ duration: 0.2 }}
                                  className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-sm border border-purple-500/20 rounded-lg shadow-2xl z-10 overflow-hidden"
                                >
                                  {smartWallets.map((smartWallet, index) => (
                                    <motion.button
                                      key={smartWallet.address}
                                      onClick={() =>
                                        handleSmartWalletSelectionChange(index)
                                      }
                                      className={`w-full p-3 text-left hover:bg-purple-500/10 transition-colors border-b border-white/5 last:border-b-0 ${
                                        selectedSmartWalletIndex === index
                                          ? "bg-purple-500/20"
                                          : ""
                                      }`}
                                      whileHover={{ x: 4 }}
                                      transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 30,
                                      }}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={`w-2 h-2 rounded-full ${
                                            selectedSmartWalletIndex === index
                                              ? "bg-purple-500"
                                              : "bg-gray-600"
                                          }`}
                                        />
                                        <div className="flex-1">
                                          <div className="text-white text-sm font-mono">
                                            {formatSmartWalletAddress(
                                              smartWallet.address,
                                            )}
                                          </div>
                                          <div className="text-gray-400 text-xs">
                                            Smart Account #{index + 1}
                                          </div>
                                        </div>
                                        {selectedSmartWalletIndex === index && (
                                          <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="text-purple-400"
                                          >
                                            <svg
                                              className="w-3 h-3"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M5 13l4 4L19 7"
                                              />
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

                      {/* Smart Account Status */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Status
                        </label>
                        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                          {smartWalletReady && smartAccountAddress ? (
                            <>
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-green-400 text-sm font-medium">
                                Ready & Deployed
                              </span>
                            </>
                          ) : smartWallet ? (
                            <>
                              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                              <span className="text-yellow-400 text-sm font-medium">
                                Initializing...
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 bg-gray-500 rounded-full" />
                              <span className="text-gray-400 text-sm font-medium">
                                Not Created
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Smart Account Address */}
                      {smartAccountAddress && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            Smart Account Address
                          </label>
                          <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                            <svg
                              className="w-4 h-4 text-purple-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                              />
                            </svg>
                            <span className="text-white text-sm font-mono flex-1">
                              {formatSmartWalletAddress(smartAccountAddress)}
                            </span>
                            <button
                              onClick={copySmartAccountAddress}
                              className="p-1.5 hover:bg-white/10 rounded-md transition-colors group"
                              title="Copy Smart Account address"
                            >
                              {smartAccountCopied ? (
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

                      {/* Smart Account Balance */}
                      {smartAccountAddress && (
                        <SmartAccountBalance
                          address={smartAccountAddress}
                          chainId={8453}
                        />
                      )}

                      {/* Network Information */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Network
                        </label>
                        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <span className="text-white text-sm">
                            Base Network (8453)
                          </span>
                        </div>
                      </div>

                      {/* Smart Account Actions */}
                      {smartAccountAddress && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <button
                            onClick={() =>
                              window.open(
                                `https://basescan.org/address/${smartAccountAddress}`,
                                "_blank",
                              )
                            }
                            className="px-4 py-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 text-purple-300 rounded-lg hover:from-purple-500/20 hover:to-blue-500/20 transition-all font-medium text-sm flex items-center justify-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                            Explorer
                          </button>
                          <button
                            onClick={() => (window.location.href = "/")}
                            className="px-4 py-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 text-green-300 rounded-lg hover:from-green-500/20 hover:to-emerald-500/20 transition-all font-medium text-sm flex items-center justify-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                              />
                            </svg>
                            Terminal
                          </button>
                        </div>
                      )}

                      {/* Create Smart Account Button */}
                      {!smartWallet && (
                        <div className="pt-2">
                          <button className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all font-medium text-sm flex items-center justify-center gap-2">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                            Create Smart Account
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

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
