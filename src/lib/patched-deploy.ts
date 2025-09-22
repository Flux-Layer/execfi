import { BiconomySmartAccountV2, ERROR_MESSAGES } from "@biconomy/account";

const originalDeploy = BiconomySmartAccountV2.prototype.deploy;

BiconomySmartAccountV2.prototype.deploy = async function (buildUseropDto: any) {
  console.log("DEPLOYING... ", { buildUseropDto });
  const accountAddress =
    (this as any)?.accountAddress ?? (await (this as any)?.getAccountAddress());
  console.log({ accountAddress });
  console.log("checking bytecode...");
  // Check that the account has not already been deployed
  const byteCode = await (this as any)?.provider?.getBytecode({
    address: accountAddress,
  });
  console.log({ byteCode });
  if (byteCode !== undefined) {
    throw new Error(ERROR_MESSAGES.ACCOUNT_ALREADY_DEPLOYED);
  }

  // Check that the account has enough native token balance to deploy, if not using a paymaster
  if (!buildUseropDto?.paymasterServiceData?.mode) {
    console.log("No paymaster, checking account token balance...");
    const nativeTokenBalance = await (this as any)?.provider?.getBalance({
      address: accountAddress,
    });
    console.log({ nativeTokenBalance });
    if (nativeTokenBalance === BigInt(0)) {
      throw new Error(ERROR_MESSAGES.NO_NATIVE_TOKEN_BALANCE_DURING_DEPLOY);
    }
  }
  const useEmptyDeployCallData = true;
  const txData = [
    {
      to: accountAddress,
      data: "0x",
    },
    { ...buildUseropDto, useEmptyDeployCallData },
  ];
  console.log({ txData });
  const transactionResult = (this as any)?.sendTransaction(...txData);
  console.log({ transactionResult });
  return transactionResult;
};
