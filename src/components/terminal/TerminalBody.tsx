import { useEffect, useState } from "react";
import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import PageBarLoader from "@components/loader";
import { ChatMessage, TerminalBodyProps, QuestionType } from "./types";
import InitialText from "./InitialText";
import PreviousQuestions from "./PreviousQuestions";
import CurrentQuestion from "./CurrentQuestion";
import ChatHistory from "./ChatHistory";
import CurLine from "./CurLine";
import useSmartWallet from "@/hooks/useSmartWallet";

const QUESTIONS: QuestionType[] = [
  {
    key: "email",
    text: "To start, could you give us ",
    postfix: "your email?",
    complete: false,
    value: "",
  },
  {
    key: "code",
    text: "Enter the code sent to ",
    postfix: "your email",
    complete: false,
    value: "",
  },
];

const TerminalBody = ({ containerRef, inputRef }: TerminalBodyProps) => {
  const { authenticated, ready, user } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { smartWalletClient, isReady: smartWalletReady, smartAccountAddress } = useSmartWallet();

  const [questions, setQuestions] = useState(QUESTIONS);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [curQuestion, setCurQuestion] = useState<any>(QUESTIONS[0]);
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");
  const [aiResponding, setAiResponding] = useState(false);

  // Token selection state
  const [tokenSelectionState, setTokenSelectionState] = useState<{
    isWaitingForSelection: boolean;
    originalPrompt: string;
    availableTokens: any[];
  } | null>(null);

  useEffect(() => {
    if (ready && authenticated) {
      setQuestions([]);
      setCurQuestion(null);
    } else if (ready && !authenticated) {
      setQuestions(QUESTIONS);
      setCurQuestion(QUESTIONS[0]);
    }
  }, [ready, authenticated]);

  const handleSubmitLine = async (value: string) => {
    // Handle token selection input
    if (tokenSelectionState?.isWaitingForSelection) {
      const selectedIndex = parseInt(value);

      if (
        isNaN(selectedIndex) ||
        selectedIndex < 1 ||
        selectedIndex > tokenSelectionState.availableTokens.length
      ) {
        setChat((prev) => [
          ...prev,
          { role: "user", content: value },
          {
            role: "assistant",
            content: `⚠️ Please enter a number between 1 and ${tokenSelectionState.availableTokens.length}`,
          },
        ]);
        setText("");
        return;
      }

      const selectedToken =
        tokenSelectionState.availableTokens[selectedIndex - 1];

      setChat((prev) => [
        ...prev,
        { role: "user", content: value },
        {
          role: "assistant",
          content: `✅ Selected: ${selectedToken.name} (${selectedToken.symbol})`,
        },
      ]);

      // Check if selected token is native ETH
      const isNativeETH =
        selectedToken.address === "0x0000000000000000000000000000000000000000";

      if (isNativeETH) {
        // Clear token selection state and continue with native ETH transaction
        const originalPrompt = tokenSelectionState.originalPrompt;
        setTokenSelectionState(null);
        setText("");

        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "🔄 Proceeding with native ETH transfer...",
          },
        ]);

        // Continue with transaction execution using native ETH
        setAiResponding(true);

        try {
          // Import orchestrator dynamically to avoid SSR issues
          const { executeTransactionFromPrompt } = await import(
            "@/lib/orchestrator"
          );

          // Modify the original prompt to explicitly use native ETH
          const nativeETHPrompt = originalPrompt.replace(/\beth\b/gi, "ETH"); // Ensure ETH is uppercase for native detection

          // Execute the full transaction pipeline with native ETH and session support
          const result = await executeTransactionFromPrompt(
            nativeETHPrompt,
            user?.id || "user-id",
            smartWalletClient,
            smartAccountAddress,
          );

          if (result.success) {
            // Success case
            setChat((prev) => [
              ...prev,
              { role: "assistant", content: result.message },
              {
                role: "assistant" as const,
                content: {
                  type: "explorer-link",
                  url: result.explorerUrl || "https://basescan.org",
                  text: `View transaction: ${result.txHash}`,
                  explorerName: "BaseScan",
                },
              },
            ]);
          } else if ("tokenSelection" in result) {
            // Shouldn't happen again, but handle just in case
            setChat((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "⚠️ Unexpected token selection required again. Please try with explicit 'ETH' in your prompt.",
              },
            ]);
          } else {
            // Clarification needed
            setChat((prev) => [
              ...prev,
              {
                role: "assistant",
                content: {
                  type: "clarification",
                  question: result.clarify,
                  missing: result.missing,
                },
              },
            ]);
          }
        } catch (error: any) {
          console.error("Token selection continuation error:", error);

          let errorMessage = `⚠️ Error: ${error.message || "Unknown error occurred"}`;

          if (error.name === "OrchestrationError") {
            const { formatOrchestrationError } = await import(
              "@/lib/orchestrator"
            );
            errorMessage = formatOrchestrationError(error);
          } else if (error.name === "IdempotencyError") {
            errorMessage = `🔄 ${error.message}`;
            if (error.existingTxHash) {
              setChat((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Previous transaction: ${error.existingTxHash}`,
                },
              ]);
            }
          }

          setChat((prev) => [
            ...prev,
            { role: "assistant", content: errorMessage },
          ]);
        } finally {
          setAiResponding(false);
        }

        return;
      } else {
        // ERC-20 token selected - not implemented yet
        setTokenSelectionState(null);
        setText("");

        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "🚧 Token selected successfully! ERC-20 execution will be implemented in future updates. For now, please use native ETH transfers.",
          },
        ]);

        return;
      }
    }

    if (curQuestion) {
      if (curQuestion?.key === "email") {
        sendCode({ email: value });
      } else if (curQuestion?.key === "code") {
        loginWithCode({ code: value });
      } else if (curQuestion?.key === "token-address-selection") {
        // Token selection is now handled by the orchestrator
        // This is a placeholder for any legacy token selection
        console.log("Token selection:", value);
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
    } else {
      // Authenticated user input - use full execution pipeline
      setChat((prev) => [...prev, { role: "user", content: value }]);
      setText("");

      // Handle special session commands
      if (
        value.toLowerCase().includes("create session") ||
        value.toLowerCase() === "session"
      ) {
        setAiResponding(true);
        try {
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "🔄 Sessions are now handled via the new Smart Sessions system. Use the smart-account page to create sessions.",
            },
          ]);
          // For now, just show info about new session system
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "✅ MEE Client ready! Visit /smart-account to test the new session system.",
            },
          ]);
        } catch (error: any) {
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `❌ Failed to create session: ${error.message}`,
            },
          ]);
        } finally {
          setAiResponding(false);
        }
        return;
      }

      if (value.toLowerCase().includes("session status")) {
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "🔴 MEE Client not ready - please wait for initialization",
          },
        ]);
        return;
      }

      // Check if required services are ready
      if (!authenticated) {
        setChat((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Please authenticate first" },
        ]);
        return;
      }

      if (!smartWalletReady || !smartWalletClient) {
        setChat((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Smart Wallet not ready. Please wait a moment and try again." },
        ]);
        return;
      }

      // Handle retry command
      if (
        value.toLowerCase().includes("retry") ||
        value.toLowerCase() === "r"
      ) {
        setAiResponding(true);
        try {
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "✅ MEE client initialized successfully!",
            },
          ]);
        } catch {
        } finally {
          setAiResponding(false);
        }
        return;
      }

      setAiResponding(true);

      try {
        // Import orchestrator dynamically to avoid SSR issues
        const { executeTransactionFromPrompt } = await import(
          "@/lib/orchestrator"
        );

        // Execute the full transaction pipeline with session support
        const result = await executeTransactionFromPrompt(
          value,
          user?.id || "user-id",
          smartWalletClient,
          smartAccountAddress,
        );

        if (result.success) {
          // Success case
          setChat((prev) => [
            ...prev,
            { role: "assistant", content: result.message },
            {
              role: "assistant",
              content: {
                type: "explorer-link",
                url: result.explorerUrl || "https://basescan.org",
                text: `View transaction: ${result.txHash}`,
                explorerName: "BaseScan",
              },
            },
          ]);
        } else if ("tokenSelection" in result) {
          // Token selection needed
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content: {
                type: "token-table",
                message: result.tokenSelection.message,
                tokens: result.tokenSelection.tokens,
              },
            },
            {
              role: "assistant",
              content: "Please enter the number of the token you want to use:",
            },
          ]);

          // Set token selection state to wait for user input
          setTokenSelectionState({
            isWaitingForSelection: true,
            originalPrompt: value,
            availableTokens: result.tokenSelection.tokens,
          });
        } else {
          // Clarification needed
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content: {
                type: "clarification",
                question: result.clarify,
                missing: result.missing,
              },
            },
          ]);
        }
      } catch (error: any) {
        console.error("Terminal execution error:", error);

        // Handle specific error types
        let errorMessage = `⚠️ Error: ${error.message || "Unknown error occurred"}`;

        if (error.name === "OrchestrationError") {
          const { formatOrchestrationError } = await import(
            "@/lib/orchestrator"
          );
          errorMessage = formatOrchestrationError(error);
        } else if (error.name === "IdempotencyError") {
          errorMessage = `🔄 ${error.message}`;
          if (error.existingTxHash) {
            setChat((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Previous transaction: ${error.existingTxHash}`,
              },
            ]);
          }
        }

        setChat((prev) => [
          ...prev,
          { role: "assistant", content: errorMessage },
        ]);
      } finally {
        setAiResponding(false);
      }
    }
  };

  return (
    <div className="p-2 text-slate-100 text-lg">
      {ready ? (
        <>
          <InitialText />
          <PreviousQuestions questions={questions} />
          <CurrentQuestion curQuestion={curQuestion} />
          {curQuestion ? (
            <>
              <ChatHistory chat={chat} />
              <CurLine
                {...{
                  text,
                  focused,
                  setText,
                  setFocused,
                  inputRef,
                  command: curQuestion?.key || "",
                  handleSubmitLine,
                  containerRef,
                }}
              />
            </>
          ) : authenticated ? (
            <>
              <ChatHistory chat={chat} />
              <CurLine
                {...{
                  text,
                  focused,
                  setText,
                  setFocused,
                  inputRef,
                  command: tokenSelectionState?.isWaitingForSelection
                    ? "select-token"
                    : "ask-ai",
                  handleSubmitLine,
                  containerRef,
                  loading: aiResponding,
                }}
              />
            </>
          ) : (
            <PageBarLoader />
          )}
        </>
      ) : (
        <PageBarLoader />
      )}
    </div>
  );
};

export default TerminalBody;
