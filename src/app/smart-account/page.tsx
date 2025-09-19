"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import useBiconomyWithSessionKey from "@hooks/useBiconomyWithSessionKey";

export default function Page() {
  const { ready, authenticated, login } = usePrivy();
  const {
    loading,
    error,
    ownerAddress,
    saAddress,
    client,
    sessionClient,
    sessionKeyAddress,
    isSessionActive,
    createSession,
    sendTxWithSession,
    sendTx
  } = useBiconomyWithSessionKey();

  const [txLoading, setTxLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  useEffect(() => {
     console.log({client, sessionClient, isSessionActive})
  },[client, sessionClient, isSessionActive])

  if (!ready) return null;
  if (!authenticated) return <button onClick={login}>Log in</button>;


  const handleCreateSession = async () => {
    try {
      setSessionLoading(true);
      await createSession(24); // 24 hours
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleRegularTransaction = async () => {
    try {
      setTxLoading(true);
      const hash = await sendTx({
        to: "0x0000000000000000000000000000000000000000",
        value: "0", // No-op transaction
      });
      console.log("Regular transaction hash:", hash);
      alert(`Regular transaction sent: ${hash}`);
    } catch (error) {
      console.error("Regular transaction failed:", error);
      alert(`Transaction failed: ${error}`);
    } finally {
      setTxLoading(false);
    }
  };

  const handleSessionTransaction = async () => {
    try {
      setTxLoading(true);
      const hash = await sendTxWithSession({
        to: "0x0000000000000000000000000000000000000000",
        value: "0", // No-op transaction
      });
      console.log("Session transaction hash:", hash);
      alert(`Session transaction sent automatically: ${hash}`);
    } catch (error) {
      console.error("Session transaction failed:", error);
      alert(`Session transaction failed: ${error}`);
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold">Account Information</h2>
        <div className="space-y-1 text-sm">
          <div>Owner (EOA): <span className="font-mono">{ownerAddress ?? "-"}</span></div>
          <div>Smart Account: <span className="font-mono">{saAddress ?? "-"}</span></div>
          {sessionKeyAddress && (
            <div>Session Key: <span className="font-mono">{sessionKeyAddress}</span></div>
          )}
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Session Keys</h2>
        <div className="space-y-2">
          <div className="text-sm">
            Status: {isSessionActive ? (
              <span className="text-green-600 font-medium">Active Session</span>
            ) : (
              <span className="text-gray-500">No Active Session</span>
            )}
          </div>

          <button
            disabled={sessionLoading || !client}
            onClick={handleCreateSession}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sessionLoading ? "Creating..." : "Create 24h Session"}
          </button>

          <p className="text-xs text-gray-600">
            Session keys allow automated transaction signing without user approval for 24 hours.
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Transaction Testing</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium">Regular Transaction</h3>
            <button
              disabled={!client || loading || txLoading}
              onClick={handleRegularTransaction}
              className="w-full border border-gray-300 px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {txLoading ? "Sending..." : "Send with User Approval"}
            </button>
            <p className="text-xs text-gray-600">
              Requires user to sign the transaction.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Session Transaction</h3>
            <button
              disabled={!isSessionActive || !client || loading || txLoading}
              onClick={handleSessionTransaction}
              className="w-full bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {txLoading ? "Sending..." : "Send Automatically"}
            </button>
            <p className="text-xs text-gray-600">
              {isSessionActive
                ? "Sends automatically without user interaction."
                : "Create a session first to enable automated signing."
              }
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-800 mb-2">How Session Keys Work</h3>
        <div className="text-sm text-yellow-700 space-y-1">
          <p>1. Create a session key that&apos;s valid for 24 hours</p>
          <p>2. The session key can sign transactions automatically</p>
          <p>3. No user approval popup for session transactions</p>
          <p>4. Session expires automatically for security</p>
        </div>
      </div>
    </div>
  );
}
