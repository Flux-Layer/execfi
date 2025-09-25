"use client";

import { useEffect, useState } from "react";
import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import PageBarLoader from "@components/loader";
import { LOGIN_WITH_EMAIL_QUESTIONS } from "@/constants/terminal-questions";
import ErrorBoundary, { TerminalErrorFallback } from "@/components/ErrorBoundary";
import {
  useTerminalState,
  useTerminalChat,
  useTerminalAuth,
  useTerminalStore,
} from "@/cli/hooks/useTerminalStore";

// Import existing components that we'll reuse
import InitialText from "./InitialText";
import PreviousQuestions from "./PreviousQuestions";
import CurrentQuestion from "./CurrentQuestion";

// New HSM-aware components
import HSMChatHistory from "./HSMChatHistory";
import HSMCurLine from "./HSMCurLine";

interface HSMTerminalBodyProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const HSMTerminalBody = ({ containerRef, inputRef }: HSMTerminalBodyProps) => {
  const { authenticated, ready } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { isAuthenticated } = useTerminalAuth();
  const { dispatch } = useTerminalStore();

  // HSM state hooks
  const mode = useTerminalState((state) => state.mode);
  const flow = useTerminalState((state) => state.flow);
  const viewStack = useTerminalState((state) => state.viewStack);
  const chatHistory = useTerminalChat();

  // Submit handler for HSM flows
  const submitInput = (text: string) => {
    dispatch({ type: "INPUT.SUBMIT", text });
  };

  // Auth state for login flow
  const [questions, setQuestions] = useState(LOGIN_WITH_EMAIL_QUESTIONS);
  const [curQuestion, setCurQuestion] = useState<any>(LOGIN_WITH_EMAIL_QUESTIONS[0]);

  // Handle login flow (existing logic)
  useEffect(() => {
    if (ready && authenticated) {
      setQuestions([]);
      setCurQuestion(null);
    } else if (ready && !authenticated) {
      setQuestions(LOGIN_WITH_EMAIL_QUESTIONS);
      setCurQuestion(LOGIN_WITH_EMAIL_QUESTIONS[0]);
    }
  }, [ready, authenticated]);

  // Auto-exit auth mode when user becomes authenticated
  useEffect(() => {
    if (mode === "AUTH" && authenticated) {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: "✅ Successfully signed in! You can now execute transactions.",
          timestamp: Date.now(),
        }
      });
      dispatch({ type: "AUTH.STOP" });
    }
  }, [mode, authenticated, dispatch]);

  const handleAuthSubmitLine = async (value: string) => {
    if (curQuestion) {
      if (curQuestion?.key === "email") {
        sendCode({ email: value });
      } else if (curQuestion?.key === "code") {
        loginWithCode({ code: value });
      }

      setQuestions((pv) =>
        pv.map((q) =>
          q.key === curQuestion.key ? { ...q, complete: true, value } : q,
        ),
      );
      setCurQuestion((prev: any) => {
        const idx = questions.findIndex((q) => q.key === prev.key);
        return questions[idx + 1] || null;
      });
    }
  };

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
          <HSMCurLine
            inputRef={inputRef}
            containerRef={containerRef}
            command={curQuestion?.key || ""}
            onSubmit={handleAuthSubmitLine}
            isAuthFlow={true}
          />
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

          {/* Mode Indicator */}
          <ModeIndicator mode={mode} viewStack={viewStack} />

          {/* Debug Info - show if stuck in FLOW for too long */}
          {mode === "FLOW" && flow && (
            <DebugInfo flow={flow} onReset={() => dispatch({ type: "APP.RESET" })} />
          )}

          {/* HSM Chat History */}
          <HSMChatHistory history={chatHistory} />

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
    switch (flow.step) {
      case "clarify":
        return "clarify";
      case "confirm":
        return "confirm";
      default:
        if (flow.tokenSelection) {
          return "select-token";
        }
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
const ModeIndicator = ({ mode, viewStack }: { mode: string; viewStack: any[] }) => {
  if (mode === "VIEW" && viewStack.length > 0) {
    const currentView = viewStack[viewStack.length - 1];
    return (
      <div className="mb-2 text-sm text-slate-400">
        📋 {currentView.kind.toUpperCase()} MODE - Type /exit to return, /home for main terminal
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