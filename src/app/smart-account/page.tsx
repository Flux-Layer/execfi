"use client";
import { usePrivy } from "@privy-io/react-auth";
import useBiconomySA from "@hooks/useBiconomySA";

export default function Page() {
  const { ready, authenticated, login } = usePrivy();
  const { loading, error, ownerAddress, saAddress, client, sendTx } =
    useBiconomySA();

  if (!ready) return null;
  if (!authenticated) return <button onClick={login}>Log in</button>;

  return (
    <div className="p-4 space-y-2">
      <div>Owner (EOA): {ownerAddress ?? "-"}</div>
      <div>Smart Account: {saAddress ?? "-"}</div>
      {error && <div className="text-red-500">{error}</div>}

      <button
        disabled={!client || loading}
        onClick={async () => {
          const hash = await sendTx({
            to: "0x0000000000000000000000000000000000000000",
            value: BigInt(0) as any, // first op will deploy SA if needed
          });
          console.log("UserOp/tx hash:", hash);
        }}
        className="border px-3 py-2 rounded"
      >
        Send No-Op
      </button>
    </div>
  );
}
