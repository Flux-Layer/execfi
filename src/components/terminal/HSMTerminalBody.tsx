"use client";

import { useEffect, useRef, useState } from "react";
import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import PageBarLoader from "@components/loader";
import { LOGIN_WITH_EMAIL_QUESTIONS } from "@/constants/terminal-questions";
import ErrorBoundary, {
   TerminalErrorFallback,
} from "@/components/ErrorBoundary";
import {
   useTerminalState,
   useTerminalChat,
   useTerminalAuth,
   useTerminalStore,
   useTerminalCore,
} from "@/cli/hooks/useTerminalStore";

// Import existing components that we'll reuse
import InitialText from "./InitialText";
import PreviousQuestions from "./PreviousQuestions";
import CurrentQuestion from "./CurrentQuestion";

// New HSM-aware components
import HSMChatHistory from "./HSMChatHistory";
import HSMCurLine from "./HSMCurLine";
import HSMViewRenderer from "./HSMViewRenderer";

interface HSMTerminalBodyProps {
   containerRef: React.RefObject<HTMLDivElement | null>;
   inputRef: React.RefObject<HTMLInputElement | null>;
}

const HSMTerminalBody = ({ containerRef, inputRef }: HSMTerminalBodyProps) => {
   const { authenticated, ready, logout } = usePrivy();
   const { sendCode, loginWithCode } = useLoginWithEmail();
   const { isAuthenticated } = useTerminalAuth();
   const { dispatch } = useTerminalStore();

   // HSM state hooks
   const mode = useTerminalState((state) => state.mode);
   const flow = useTerminalState((state) => state.flow);
   const viewStack = useTerminalState((state) => state.viewStack);
   const chatHistory = useTerminalChat();
   const coreContext = useTerminalCore();

   // Submit handler for HSM flows
   const submitInput = (text: string) => {
      dispatch({ type: "INPUT.SUBMIT", text });
   };

   // Auth state for login flow
   const [questions, setQuestions] = useState(() =>
      LOGIN_WITH_EMAIL_QUESTIONS.map((q) => ({ ...q })),
   );
   const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
   const [authStatus, setAuthStatus] = useState<
      "idle" | "sending-code" | "code-sent" | "verifying" | "awaiting-auth" | "error"
   >("idle");
   const [authError, setAuthError] = useState<string | null>(null);
   const activeAuthRequestRef = useRef<number | null>(null);

   // Handle login flow (existing logic)
   useEffect(() => {
      if (ready && authenticated) {
         activeAuthRequestRef.current = null;
         setQuestions([]);
         setCurrentQuestionIndex(0);
         setAuthStatus("idle");
         setAuthError(null);
      } else if (ready && !authenticated) {
         activeAuthRequestRef.current = null;
         setQuestions(LOGIN_WITH_EMAIL_QUESTIONS.map((q) => ({ ...q })));
         setCurrentQuestionIndex(0);
         setAuthStatus("idle");
         setAuthError(null);
      }
   }, [ready, authenticated]);

   // Auto-exit auth mode when user becomes authenticated
   useEffect(() => {
      if (mode === "AUTH" && authenticated) {
         dispatch({ type: "AUTH.SUCCESS" });
      }
   }, [mode, authenticated, dispatch]);

   // Auto-scroll to bottom when chat history updates
   useEffect(() => {
      if (containerRef.current) {
         containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
   }, [chatHistory, containerRef]);

   // Auto-focus input on page load and mode changes
   useEffect(() => {
      if (inputRef.current && mode !== "FLOW") {
         const timer = setTimeout(() => {
            inputRef.current?.focus();
         }, 100); // Small delay to ensure DOM is ready
         return () => clearTimeout(timer);
      }
   }, [mode, inputRef]);

   // Handle logout when logout message appears
   useEffect(() => {
      const lastMessage = chatHistory[chatHistory.length - 1];
      if (
         lastMessage?.role === "assistant" &&
         lastMessage?.content === "🔓 Signing out..." &&
         authenticated
      ) {
         logout()
            .then(() => {
               dispatch({
                  type: "CHAT.ADD",
                  message: {
                     role: "assistant",
                     content:
                        "✅ Successfully signed out. You can use /login to sign in again.",
                     timestamp: Date.now(),
                  },
               });
            })
            .catch((error) => {
               console.error("Logout failed:", error);
               dispatch({
                  type: "CHAT.ADD",
                  message: {
                     role: "assistant",
                     content:
                        "❌ Sign out failed. Please try again or use the profile menu.",
                     timestamp: Date.now(),
                  },
               });
            });
      }
   }, [chatHistory, authenticated, logout, dispatch]);

   const handleAuthSubmitLine = (value: string) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
         return;
      }

      const normalizedValue = trimmedValue.toLowerCase();

      if (normalizedValue === "/cancel") {
         activeAuthRequestRef.current = null;
         setQuestions(LOGIN_WITH_EMAIL_QUESTIONS.map((q) => ({ ...q })));
         setCurrentQuestionIndex(0);
         setAuthStatus("idle");
         setAuthError(null);
         dispatch({ type: "AUTH.CANCEL" });
         return;
      }

      if (authStatus === "verifying" || authStatus === "awaiting-auth") {
         setAuthError("We're verifying your code. Type /cancel to stop or wait a moment.");
         return;
      }

      const curQuestion = questions[currentQuestionIndex];
      if (!curQuestion) {
         return;
      }

      setAuthError(null);

      if (curQuestion.key === "email") {
         const requestId = Date.now();
         activeAuthRequestRef.current = requestId;
         setAuthStatus("sending-code");
         void sendCode({ email: trimmedValue })
            .then(() => {
               if (activeAuthRequestRef.current !== requestId) {
                  return;
               }

               setQuestions((prev) =>
                  prev.map((q) => {
                     if (q.key === "email") {
                        return { ...q, complete: true, value: trimmedValue };
                     }
                     if (q.key === "code") {
                        return { ...q, complete: false, value: "" };
                     }
                     return q;
                  }),
               );
               setCurrentQuestionIndex((prev) =>
                  Math.min(prev + 1, LOGIN_WITH_EMAIL_QUESTIONS.length - 1),
               );
               setAuthStatus("code-sent");
               activeAuthRequestRef.current = null;
            })
            .catch((error) => {
               if (activeAuthRequestRef.current !== requestId) {
                  return;
               }

               console.error("Error sending verification code from terminal:", error);
               setAuthStatus("error");
               setAuthError(
                  "We couldn't send a code to that email. Please check the address and try again.",
               );
               activeAuthRequestRef.current = null;
            });
         return;
      }

      if (curQuestion.key === "code") {
         const requestId = Date.now();
         activeAuthRequestRef.current = requestId;
         setAuthStatus("verifying");
         void loginWithCode({ code: trimmedValue })
            .then(() => {
               if (activeAuthRequestRef.current !== requestId) {
                  return;
               }

               setQuestions((prev) =>
                  prev.map((q) =>
                     q.key === "code"
                        ? { ...q, complete: true, value: trimmedValue }
                        : q,
                  ),
               );
               setAuthStatus("awaiting-auth");
               activeAuthRequestRef.current = null;
            })
            .catch((error) => {
               if (activeAuthRequestRef.current !== requestId) {
                  return;
               }

               console.error("Error logging in with verification code from terminal:", error);
               setAuthStatus("error");
               setAuthError("That code didn't work. Please try again.");
               setQuestions((prev) =>
                  prev.map((q) =>
                     q.key === "code"
                        ? { ...q, complete: false, value: "" }
                        : q,
                  ),
               );
               activeAuthRequestRef.current = null;
            });
      }
   };

   const curQuestion = questions[currentQuestionIndex] ?? null;

   const isAuthLoading =
      authStatus === "sending-code" ||
      authStatus === "verifying" ||
      authStatus === "awaiting-auth";

   // Show loading only while Privy is initializing
   if (!ready) {
      return (
         <div className="p-2 text-slate-100 text-lg">
            <PageBarLoader />
         </div>
      );
   }

   // Show auth flow when in AUTH mode or when explicitly requested
   const showAuthFlow = mode === "AUTH" && !isAuthenticated;

   if (showAuthFlow) {
      return (
         <ErrorBoundary fallback={TerminalErrorFallback}>
            <div className="p-2 text-slate-100 text-lg">
               <InitialText />
               <PreviousQuestions questions={questions} />
               <CurrentQuestion curQuestion={curQuestion} />
               <p className="mt-2 text-sm text-slate-400 font-mono">
                  Need to stop? Type /cancel anytime to exit this login flow.
               </p>
               <HSMCurLine
                  inputRef={inputRef}
                  containerRef={containerRef}
                  command={curQuestion?.key || ""}
                  onSubmit={handleAuthSubmitLine}
                  isAuthFlow={true}
                  loading={isAuthLoading}
                  lockInputWhileLoading={
                     authStatus !== "verifying" && authStatus !== "awaiting-auth"
                  }
               />
               {authStatus === "code-sent" && !authError && (
                  <p className="mt-3 text-sm text-emerald-400 font-mono">
                     Check your email for the verification code.
                  </p>
               )}
               {authStatus === "verifying" && (
                  <p className="mt-3 text-sm text-slate-400 font-mono">
                     Verifying your code. Hang tight... (type /cancel to stop)
                  </p>
               )}
               {authStatus === "awaiting-auth" && (
                  <p className="mt-3 text-sm text-slate-400 font-mono">
                     Waiting for confirmation from Privy... (type /cancel to stop)
                  </p>
               )}
               {authError && (
                  <p className="mt-3 text-sm text-rose-400 font-mono">
                     {authError}
                  </p>
               )}
            </div>
         </ErrorBoundary>
      );
   }

   // Main HSM terminal UI
   return (
      <ErrorBoundary fallback={TerminalErrorFallback}>
         <div className="relative h-full">
            {/* Main content area */}
            <div className="p-2 text-slate-100 text-lg h-full">
               <InitialText />

               {/* Debug Info - show if stuck in FLOW for too long */}
               {mode === "FLOW" && flow && (
                  <DebugInfo
                     flow={flow}
                     onReset={() => dispatch({ type: "APP.RESET" })}
                  />
               )}

               {/* HSM Chat History */}
               <HSMChatHistory history={chatHistory} />

               {/* Mode Indicator */}
               <ModeIndicator mode={mode} viewStack={viewStack} />

               {/* View Renderer - show view content when in VIEW mode */}
               {mode === "VIEW" && (
                  <HSMViewRenderer
                     viewStack={viewStack}
                     core={
                        coreContext || {
                           chainId: 8453,
                           userId: undefined,
                           accountMode: "EOA",
                           idempotency: new Map(),
                        }
                     }
                  />
               )}

               {/* HSM Input Line */}
               <HSMCurLine
                  inputRef={inputRef}
                  containerRef={containerRef}
                  command={getCommandPrompt(mode, flow)}
                  onSubmit={submitInput}
                  isAuthFlow={false}
               />
            </div>
         </div>
      </ErrorBoundary>
   );
};

// Helper to determine command prompt based on state
function getCommandPrompt(mode: string, flow: any): string {
   if (mode === "FLOW" && flow) {
      // Check for token selection first, regardless of step
      if (flow.tokenSelection) {
         return "select-token";
      }

      switch (flow.step) {
         case "clarify":
            return "clarify";
         case "confirm":
            return "confirm";
         case "normalize":
         case "validate":
         case "simulate":
         case "execute":
         case "monitor":
            return "processing";
         default:
            return "processing";
      }
   }

   if (mode === "VIEW") {
      return "view-mode";
   }

   if (mode === "AUTH") {
      return "login";
   }

   return "ask-ai";
}

// Add a mode indicator component
const ModeIndicator = ({
   mode,
   viewStack,
}: {
   mode: string;
   viewStack: any[];
}) => {
   if (mode === "VIEW" && viewStack.length > 0) {
      const currentView = viewStack[viewStack.length - 1];
      return (
         <div className="mb-2 text-sm text-slate-400">
            📋 {currentView.kind.toUpperCase()} MODE - Type /exit to return, /home
            for main terminal
         </div>
      );
   }

   if (mode === "FLOW") {
      return (
         <div className="mb-2 text-sm text-slate-400">
            ⚡ TRANSACTION FLOW - Processing your request...
         </div>
      );
   }

   if (mode === "AUTH") {
      return (
         <div className="mb-2 text-sm text-slate-400">
            🔐 AUTHENTICATION MODE - Enter your email, or type /cancel to exit
         </div>
      );
   }

   return null;
};

// Debug info component for stuck flows
const DebugInfo = ({ flow, onReset }: { flow: any; onReset: () => void }) => {
   const [showDebug, setShowDebug] = useState(false);

   // Auto-show debug after 30 seconds
   useEffect(() => {
      const timer = setTimeout(() => setShowDebug(true), 30000);
      return () => clearTimeout(timer);
   }, [flow.step]);

   if (!showDebug) return null;

   return (
      <div className="mb-2 p-2 bg-yellow-900/20 border border-yellow-600/30 rounded text-xs text-yellow-200">
         <div className="flex items-center justify-between">
            <span>
               🐛 Flow stuck in &quot;{flow.step}&quot; step for 30+ seconds
            </span>
            <div className="space-x-2">
               <button
                  onClick={onReset}
                  className="px-2 py-1 bg-red-600/70 hover:bg-red-600 rounded text-white"
               >
                  Reset
               </button>
               <button
                  onClick={() => setShowDebug(false)}
                  className="px-2 py-1 bg-gray-600/70 hover:bg-gray-600 rounded text-white"
               >
                  Hide
               </button>
            </div>
         </div>
         <div className="mt-1 text-xs text-gray-400">
            Try typing: /reset or /home to recover
         </div>
         {flow.error && (
            <div className="mt-1 text-xs text-red-400">
               Error: {flow.error.message}
            </div>
         )}
      </div>
   );
};

export default HSMTerminalBody;
