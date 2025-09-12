"use client";

import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import {  useState } from "react";
import TextInput from "../../components/text-input";
import SplashButton from "../../components/splash-button";

export default function Page() {
  const { authenticated, logout } = usePrivy();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [codeSent, setCodeSent] = useState(false);



  return (
    <main className="w-full h-screen flex flex-col items-center justify-center bg-black gap-8">
      <h1 className="text-3xl text-white font-bold">Sign in with your email</h1>

      <div className="flex flex-col justify-center gap-4">
        {!authenticated ? (
          <>
            <div className="flex items-center gap-2 w-full">
              <TextInput
                placeholder="Enter your email"
                onChangeCallback={(v) => setEmail(v)}
                withActionButton
                actionButtonCaption="Send Code"
                actionButtonCallback={() => {
                  sendCode({ email });
                  setCodeSent(true);
                }}
              />
            </div>
            {codeSent && (
              <div className="flex items-center gap-2 w-full">
                <TextInput
                  placeholder="Enter the code sent to your email"
                  onChangeCallback={(v) => setCode(v)}
                  withActionButton
                  actionButtonCaption="Sign in"
                  actionButtonCallback={() => loginWithCode({ code })}
                />
              </div>
            )}
          </>
        ) : (
          <SplashButton caption="Logout" callback={() => logout()} />
        )}
      </div>
    </main>
  );
}
