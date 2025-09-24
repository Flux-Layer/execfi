"use client";

import { motion } from "framer-motion";
import { FormEvent, ChangeEvent, useEffect, useState } from "react";
import PageBarLoader from "@components/loader";
import { useTerminalInput } from "@/cli/hooks/useTerminalStore";

interface HSMCurLineProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  command: string;
  onSubmit: (value: string) => void;
  isAuthFlow?: boolean;
  loading?: boolean;
}

const HSMCurLine = ({
  inputRef,
  containerRef,
  command,
  onSubmit,
  isAuthFlow = false,
  loading = false,
}: HSMCurLineProps) => {
  // For auth flow, use local state since it doesn't go through HSM
  const [localInputText, setLocalInputText] = useState("");
  const { inputText: hsmInputText, setInputText: setHSMInputText } = useTerminalInput();

  const inputText = isAuthFlow ? localInputText : hsmInputText;
  const setInputText = isAuthFlow ? setLocalInputText : setHSMInputText;

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = inputText;

    // For confirmation, allow empty input to mean "yes"
    if (command === "confirm") {
      onSubmit(value.trim() || "yes");
      setInputText("");
    } else if (value.trim()) {
      onSubmit(value.trim());
      setInputText("");
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputText(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle ESC key to cancel confirmation
    if (e.key === "Escape" && command === "confirm") {
      e.preventDefault();
      onSubmit("no");
      setInputText("");
    }
  };

  // Auto-focus and scroll
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    scrollToBottom();
  }, [command, inputRef]);

  useEffect(() => {
    scrollToBottom();
  }, [containerRef]);

  const getCommandPrompt = (): string => {
    switch (command) {
      case "email":
        return "📧 Enter your email";
      case "code":
        return "🔑 Enter verification code";
      case "ask-ai":
        return "💬 Ask me anything";
      case "select-token":
        return "🪙 Select token";
      case "clarify":
        return "❓ Please clarify";
      case "confirm":
        return "✅ Confirm transaction (press Enter)";
      case "processing":
        return "⏳ Processing";
      case "view-mode":
        return "📋 View";
      default:
        return "💭 Terminal";
    }
  };

  const getInputPlaceholder = (): string => {
    switch (command) {
      case "email":
        return "your@email.com";
      case "code":
        return "123456";
      case "ask-ai":
        return "Send 0.1 ETH to vitalik.eth";
      case "select-token":
        return "Enter token number (e.g., 1)";
      case "clarify":
        return "Provide more details...";
      case "confirm":
        return "Press Enter to confirm, type 'no' or Esc to cancel";
      case "processing":
        return "Please wait...";
      case "view-mode":
        return "Type command or transaction (/exit to return)";
      default:
        return "Type your command...";
    }
  };

  const isInputDisabled = (): boolean => {
    return loading || command === "processing";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center space-x-2 mt-4"
    >
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        <span className="text-emerald-400 font-semibold flex-shrink-0">
          {getCommandPrompt()}
        </span>

        {loading && (
          <div className="flex-shrink-0">
            <PageBarLoader />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type={command === "code" ? "text" : command === "email" ? "email" : "text"}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={getInputPlaceholder()}
            disabled={isInputDisabled()}
            className="bg-transparent border-none outline-none text-slate-100 w-full placeholder-slate-500 disabled:opacity-50"
            autoComplete={command === "email" ? "email" : "off"}
            spellCheck={false}
          />
        </form>
      </div>

      {/* Cursor animation */}
      {!loading && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
          className="text-emerald-400 font-bold"
        >
          █
        </motion.span>
      )}
    </motion.div>
  );
};

export default HSMCurLine;