"use client";

import { motion } from "framer-motion";
import {
  FormEvent,
  ChangeEvent,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import PageBarLoader from "@components/loader";
import { useTerminalInput } from "@/cli/hooks/useTerminalStore";

interface HSMCurLineProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  command: string;
  onSubmit: (value: string) => void;
  isAuthFlow?: boolean;
  loading?: boolean;
  lockInputWhileLoading?: boolean;
}

const HSMCurLine = ({
  inputRef,
  containerRef,
  command,
  onSubmit,
  isAuthFlow = false,
  loading = false,
  lockInputWhileLoading = true,
}: HSMCurLineProps) => {
  // For auth flow, use local state since it doesn't go through HSM
  const [localInputText, setLocalInputText] = useState("");
  const { inputText: hsmInputText, setInputText: setHSMInputText } = useTerminalInput();
  
  const [cursorPosition, setCursorPosition] = useState(0);
  const measureRef = useRef<HTMLSpanElement>(null);

  const inputText = isAuthFlow ? localInputText : hsmInputText;
  const setInputText = isAuthFlow ? setLocalInputText : setHSMInputText;

  // Update cursor position when input changes or cursor moves
  const updateCursorPosition = useCallback(() => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart || 0);
    }
  }, [inputRef]);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [containerRef]);

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
    // Update cursor position after state update
    setTimeout(updateCursorPosition, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Update cursor position after key press
    setTimeout(updateCursorPosition, 0);
    // Handle ESC key to cancel confirmation
    if (e.key === "Escape" && command === "confirm") {
      e.preventDefault();
      onSubmit("no");
      setInputText("");
    }

    // Handle /exit command during processing state
    if (e.key === "Enter" && command === "processing") {
      const trimmedInput = inputText.trim();
      if (trimmedInput === "/exit" || trimmedInput === "/close") {
        e.preventDefault();
        onSubmit(trimmedInput);
        setInputText("");
      }
    }
  };

  // Auto-focus and scroll
  useEffect(() => {
    if (inputRef.current && !loading) {
      inputRef.current.focus();
    }
    scrollToBottom();
  }, [command, inputRef, loading, scrollToBottom]);

  // Scroll when container changes or when content updates
  useEffect(() => {
    const scrollTimer = setTimeout(() => {
      scrollToBottom();
    }, 50); // Small delay to ensure DOM updates are complete
    return () => clearTimeout(scrollTimer);
  }, [containerRef, scrollToBottom]);

  // Auto-focus on page load
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      if (inputRef.current && !loading) {
        inputRef.current.focus();
      }
    }, 200); // Longer delay for initial page load
    return () => clearTimeout(focusTimer);
  }, [inputRef, loading]);

  // Track cursor position on clicks and selection changes
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleSelectionChange = () => {
      updateCursorPosition();
    };

    input.addEventListener('click', handleSelectionChange);
    input.addEventListener('keyup', handleSelectionChange);
    input.addEventListener('select', handleSelectionChange);

    return () => {
      input.removeEventListener('click', handleSelectionChange);
      input.removeEventListener('keyup', handleSelectionChange);
      input.removeEventListener('select', handleSelectionChange);
    };
  }, [inputRef, updateCursorPosition]);

  // Calculate cursor offset based on text width
  const textBeforeCursor = inputText.substring(0, cursorPosition);
  const getCursorOffset = () => {
    if (measureRef.current) {
      return measureRef.current.offsetWidth;
    }
    return 0;
  };

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
        return "Please wait... (type /exit to cancel)";
      case "view-mode":
        return "Type command or transaction (/exit to return)";
      default:
        return "Type your command...";
    }
  };

  const isInputDisabled = (): boolean => {
    // Always allow input when typing /exit to escape stuck states
    if (
      inputText.startsWith("/exit") ||
      inputText.startsWith("/close") ||
      inputText.startsWith("/cancel")
    ) {
      return false;
    }
    const shouldLockForLoading = loading && lockInputWhileLoading;
    return shouldLockForLoading || command === "processing";
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

        <form onSubmit={handleSubmit} className="flex-1 min-w-0 relative">
          {/* Hidden span to measure text width */}
          <span
            ref={measureRef}
            className="absolute invisible whitespace-pre font-mono text-slate-100"
            style={{ fontSize: 'inherit', fontFamily: 'inherit' }}
          >
            {textBeforeCursor}
          </span>

          <input
            ref={inputRef}
            type={command === "code" ? "text" : command === "email" ? "email" : "text"}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={getInputPlaceholder()}
            disabled={isInputDisabled()}
            className="bg-transparent border-none outline-none text-slate-100 w-full placeholder-slate-500 disabled:opacity-50 font-mono"
            autoComplete={command === "email" ? "email" : "off"}
            spellCheck={false}
          />

          {/* Cursor animation positioned at actual cursor location */}
          {!loading && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
              className="absolute text-emerald-400 font-bold pointer-events-none"
              style={{
                left: `${getCursorOffset()}px`,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              █
            </motion.span>
          )}
        </form>
      </div>
    </motion.div>
  );
};

export default HSMCurLine;
