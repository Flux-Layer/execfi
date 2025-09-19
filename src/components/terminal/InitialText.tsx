import { usePrivy } from "@privy-io/react-auth";
import useBiconomyWithSessionKey from "@/hooks/useBiconomyWithSessionKey";
import SmartAccountInfo from "./SmartAccountInfo";

const InitialText = () => {
  const { authenticated, user } = usePrivy();
  const { saAddress } = useBiconomyWithSessionKey();

  return !authenticated ? (
    <>
      <p>
        👋 Hey there! Let&apos;s{" "}
        <span className="text-blue-200">get you connected.</span>
      </p>
      <p className="whitespace-nowrap overflow-hidden font-light">
        ------------------------------------------------------------------------
      </p>
    </>
  ) : (
    <>
      <p>
        🔓 <span className="text-blue-200">Access</span> granted.
      </p>
      <p className="whitespace-nowrap overflow-hidden font-light">
        ------------------------------------------------------------------------
      </p>
      <p>Logged in with email, {String(user?.email?.address || "")}.</p>

      {saAddress && <SmartAccountInfo address={saAddress} />}
    </>
  );
};

export default InitialText;
