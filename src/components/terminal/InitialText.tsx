import { usePrivy } from "@privy-io/react-auth";
import SmartAccountInfo from "./SmartAccountInfo";

const InitialText = () => {
  const { authenticated, user } = usePrivy();

  return !authenticated ? (
    <>
      <p>
        👋 Hey there! Welcome to <span className="text-emerald-400">ExecFi Terminal</span>.
      </p>
      <p>
        💬 You can explore and ask questions without logging in.
      </p>
      <p>
        🔐 <span className="text-blue-200">Log in</span> to execute transactions and manage your assets.
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
    </>
  );
};

export default InitialText;
