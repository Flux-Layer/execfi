// components/terminal/ExecutionTerminal.tsx - Simplified terminal with full execution pipeline

"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import useBiconomySA from "@/hooks/useBiconomySA";
import {
  executeTransactionFromPrompt,
  OrchestrationError,
  formatOrchestrationError,
  type OrchestrationResponse,
} from "@/lib/orchestrator";
import { IdempotencyError } from "@/lib/idempotency";

interface Message {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  explorerLink?: {
    url: string;
    text: string;
  };
}

export default function ExecutionTerminal() {
  const { user } = usePrivy();
  const { client: biconomyClient, saAddress, error: saError } = useBiconomySA();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "system",
      content: "Welcome to ExecFi! Type a command like: 'transfer 0.001 ETH on base to 0x...'",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const addMessage = (type: Message["type"], content: string, explorerLink?: Message["explorerLink"]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      explorerLink,
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isProcessing) return;

    const userInput = input.trim();
    setInput("");

    // Add user message
    addMessage("user", userInput);

    // Check if required services are ready
    if (!user?.id) {
      addMessage("assistant", "⚠️ Please authenticate first");
      return;
    }

    if (!biconomyClient || !saAddress) {
      addMessage("assistant", "⚠️ Smart Account not ready. Please wait for initialization...");
      return;
    }

    if (saError) {
      addMessage("assistant", `⚠️ Smart Account error: ${saError}`);
      return;
    }

    setIsProcessing(true);

    try {
      // Execute the full transaction pipeline
      const result: OrchestrationResponse = await executeTransactionFromPrompt(
        userInput,
        user.id,
        biconomyClient,
        saAddress,
      );

      if (result.success) {
        // Success case
        addMessage("assistant", result.message, {
          url: result.explorerLink.url,
          text: result.explorerLink.text,
        });

        addMessage("system", `Transaction confirmed! View on ${result.explorerLink.explorerName}`);
      } else if ("tokenSelection" in result) {
        // Token selection needed
        addMessage("assistant", `🔍 ${result.tokenSelection.message}`);
        addMessage("system", "Please specify the token by number from the table above.");
      } else {
        // Clarification needed
        addMessage("assistant", `❓ ${result.clarify}`);
        if (result.missing.length > 0) {
          addMessage("system", `Missing: ${result.missing.join(", ")}`);
        }
      }

    } catch (error: any) {
      console.error("Terminal execution error:", error);

      // Handle specific error types
      if (error instanceof OrchestrationError) {
        addMessage("assistant", formatOrchestrationError(error));
      } else if (error instanceof IdempotencyError) {
        addMessage("assistant", `🔄 ${error.message}`);
        if (error.existingTxHash) {
          // TODO: Add explorer link for existing transaction
          addMessage("system", `Previous transaction: ${error.existingTxHash}`);
        }
      } else {
        addMessage("assistant", `⚠️ Error: ${error.message || "Unknown error occurred"}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-96 bg-slate-950/90 backdrop-blur rounded-lg overflow-hidden shadow-xl font-mono">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-slate-300 text-sm">ExecFi Terminal</span>
        </div>
        <div className="text-slate-400 text-xs">
          {saAddress ? `SA: ${saAddress.slice(0, 8)}...${saAddress.slice(-6)}` : "Initializing..."}
        </div>
      </div>

      {/* Messages */}
      <div className="h-80 overflow-y-auto p-4 space-y-2">
        {messages.map((message) => (
          <div key={message.id} className="flex flex-col">
            <div className={`text-sm ${
              message.type === "user"
                ? "text-blue-300"
                : message.type === "assistant"
                ? "text-green-300"
                : "text-slate-400"
            }`}>
              <span className="text-slate-500 text-xs">
                {message.type === "user" ? "$ " : message.type === "assistant" ? "→ " : "• "}
              </span>
              {message.content}
            </div>
            {message.explorerLink && (
              <div className="ml-4 mt-1">
                <a
                  href={message.explorerLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 text-xs underline hover:text-cyan-300"
                >
                  🔗 {message.explorerLink.text}
                </a>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="text-yellow-300 text-sm">
            <span className="text-slate-500 text-xs">⏳ </span>
            Processing transaction...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-700 p-4">
        <form onSubmit={handleSubmit} className="flex">
          <span className="text-slate-500 mr-2">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder="transfer 0.001 ETH on base to 0x..."
            className="flex-1 bg-transparent text-slate-100 outline-none placeholder-slate-500 disabled:opacity-50"
            autoFocus
          />
        </form>
      </div>
    </div>
  );
}