import { usePrivy } from "@privy-io/react-auth";

const InitialText = () => {
  const { authenticated, user } = usePrivy();

  return !authenticated ? (
    <>
      <p>
        👋 Hey there! Let’s{" "}
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
    </>
  );
};

export default InitialText;
