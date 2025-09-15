import { useEffect, useState } from "react";
import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import PageBarLoader from "@components/loader";
import useBiconomySA from "@/hooks/useBiconomySA";
import { fetcher } from "@/lib/utils/fetcher";
import {
  parseIntent,
  IntentParseError,
  isIntentSuccess,
  isIntentClarify,
  isTransferIntent,
  type Intent,
} from "@/lib/ai";
import {
  ChatMessage,
  TerminalBodyProps,
  QuestionType,
} from "./types";
import InitialText from "./InitialText";
import PreviousQuestions from "./PreviousQuestions";
import CurrentQuestion from "./CurrentQuestion";
import ChatHistory from "./ChatHistory";
import CurLine from "./CurLine";
import { useBalance } from "wagmi";
import { formatBalanceDisplay, formatBalance } from "@/lib/utils/balance";

const QUESTIONS: QuestionType[] = [
  { key: "email", text: "To start, could you give us ", postfix: "your email?", complete: false, value: "" },
  { key: "code", text: "Enter the code sent to ", postfix: "your email", complete: false, value: "" },
];

interface TokenResponse {
  data: {
    chainId: number;
    address: string;
    symbol: string;
    name: string;
    metadata?: { logoURI?: string; verified?: boolean };
  }[];
  status: number;
}

const TerminalBody = ({ containerRef, inputRef }: TerminalBodyProps) => {
  const { saAddress } = useBiconomySA();
  const { authenticated, ready } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();

  const [questions, setQuestions] = useState(QUESTIONS);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [curQuestion, setCurQuestion] = useState<any>(QUESTIONS[0]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");
  const [tokenSelections, setTokenSelections] = useState<any[]>([]);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [aiResponding, setAiResponding] = useState(false);

  // transfer intent dari AI
  const [transferAmount, setTransferAmount] = useState<number | null>(null);
  const [transferRecipient, setTransferRecipient] = useState<string>("");

  useEffect(() => {
    if (ready && authenticated) {
      setQuestions([]);
      setCurQuestion(null);
    } else if (ready && !authenticated) {
      setQuestions(QUESTIONS);
      setCurQuestion(QUESTIONS[0]);
    }
  }, [ready, authenticated]);

  // wagmi balance hook
  const balanceQuery = useBalance({
    address: saAddress as `0x${string}` | undefined,
    token: selectedToken?.symbol === "ETH" ? undefined : (selectedToken?.address as `0x${string}` | undefined),
    chainId: selectedToken?.chainId,
    query: {
      enabled: Boolean(saAddress && selectedToken),
      refetchOnWindowFocus: false,
    },
  });
  

  // cek saldo setiap kali balance berubah
  useEffect(() => {

    console.log("▶ useEffect fired");
    console.log("selectedToken:", selectedToken);
    console.log("balanceQuery.data:", balanceQuery.data);
    console.log("transferAmount:", transferAmount);


    if (!balanceQuery.data || !selectedToken) return;

    const balanceFormatted = formatBalance(balanceQuery.data.value, balanceQuery.data.decimals);
    const balanceDisplay = formatBalanceDisplay(balanceQuery.data.value, balanceQuery.data.decimals, selectedToken.symbol);
    const balance = parseFloat(balanceFormatted);

    console.log("🔎 Selected token:", selectedToken);
    console.log("🔎 Balance raw:", balanceQuery.data.value.toString());
    console.log("🔎 Decimals:", balanceQuery.data.decimals);
    console.log("🔎 Formatted balance:", balanceFormatted);
    console.log("🔎 Parsed balance:", balance);
    console.log("🔎 Transfer amount:", transferAmount);

    if (balance <= 0) {
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Insufficient balance. You only have 0 ${selectedToken.symbol}`,
        },
      ]);
    } else if (transferAmount !== null && balance < transferAmount) {
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Insufficient balance. You only have ${balanceDisplay}, but you want to send ${transferAmount}.`,
        },
      ]);
    } else if (transferAmount !== null) {
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ You have ${balanceDisplay}, enough to send ${transferAmount}.`,
        },
      ]);
    }
  }, [balanceQuery.data, selectedToken, transferAmount]);

  const handleSubmitLine = async (value: string) => {
    if (curQuestion) {
      if (curQuestion?.key === "email") {
        sendCode({ email: value });
        setEmail(value);
      } else if (curQuestion?.key === "code") {
        loginWithCode({ code: value });
        setCode(value);
      } else if (curQuestion?.key === "token-address-selection") {
        const token = tokenSelections?.find((t) => t?.id === Number(value));
        console.log("🪙 Selected token:", token);
        setSelectedToken(token);
      }

      setQuestions((pv) =>
        pv.map((q) =>
          q.key === curQuestion.key ? { ...q, complete: true, value } : q
        )
      );
      setCurQuestion((prev: any) => {
        const idx = questions.findIndex((q) => q.key === prev.key);
        return questions[idx + 1] || null;
      });
    } else {
      setChat((prev) => [...prev, { role: "user", content: value }]);
      setText("");

      try {
        setAiResponding(true);

        // Parse intent using our new AI system
        const intentResult: Intent = await parseIntent(value);

        // Debug: Log the AI response
        console.log("🤖 AI Response:", JSON.stringify(intentResult, null, 2));

        if (isIntentClarify(intentResult)) {
          // Handle clarification request
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content: {
                type: "clarification",
                question: intentResult.clarify,
                missing: intentResult.missing,
              },
            },
          ]);
          setAiResponding(false);
          return;
        }

        if (isIntentSuccess(intentResult) && isTransferIntent(intentResult.intent)) {
          const { intent } = intentResult;

          // Extract transfer details
          const detectedSymbol = intent.token.symbol;
          const detectedAmount = intent.amount;
          const detectedRecipient = intent.recipient;

          setTransferAmount(
            detectedAmount !== "MAX" ? Number(detectedAmount) : null
          );
          setTransferRecipient(detectedRecipient || "");

          // Show parsed intent summary
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content: {
                type: "intent-summary",
                action: intent.action,
                chain: intent.chain.toString(),
                token: detectedSymbol,
                amount: detectedAmount,
                recipient: detectedRecipient,
              },
            },
          ]);

          // Map chain names to chainIds for token fetching
          const getChainId = (chain: string | number) => {
            if (typeof chain === "number") return chain;
            const chainMap: Record<string, number> = {
              "base": 8453,
              "baseSepolia": 84532,
              "base-sepolia": 84532,
              "baseMainnet": 8453,
              "base-mainnet": 8453,
            };
            return chainMap[chain] || 8453; // Default to Base mainnet
          };

          const targetChainId = getChainId(intent.chain);
          console.log("🔍 Fetching tokens for symbol:", detectedSymbol, "on chain:", targetChainId);

          // Always fetch tokens to show selection table
          const tokens: TokenResponse | null = detectedSymbol
            ? (await fetcher("", "/api/relay", {
                method: "POST",
                body: { chainIds: [targetChainId], term: detectedSymbol, limit: 15 },
              } as any)) as TokenResponse
            : null;

          if (tokens && Array.isArray(tokens.data) && tokens.data.length > 0) {
            // Add native ETH as first option for ETH transfers
            let tokenOptions = tokens.data;
            if (intent.token.type === "native" && intent.token.symbol === "ETH") {
              const nativeETH = {
                chainId: targetChainId,
                address: "native",
                symbol: "ETH",
                name: "Ethereum (Native)",
                metadata: { logoURI: "", verified: true }
              };
              tokenOptions = [nativeETH, ...tokens.data];
            }

            setTokenSelections(tokenOptions.map((t, i) => ({ id: i + 1, ...t })));

            setChat((prev) => [
              ...prev,
              {
                role: "assistant",
                content: {
                  message: "👉 Please choose the token by number (No).",
                  type: "token-table",
                  tokens: tokenOptions.map((t, i) => ({
                    id: i + 1,
                    chainId: t.chainId,
                    address: t.address,
                    name: t.name,
                    symbol: t.symbol,
                    logoURI: t.metadata?.logoURI,
                    verified: t.metadata?.verified,
                  })),
                },
              },
            ]);

            setQuestions([
              {
                key: "token-address-selection",
                text: "Choose the token ",
                postfix: "by number",
                complete: false,
                value: "",
              },
            ]);
            setCurQuestion({
              key: "token-address-selection",
              text: "Choose the token ",
              postfix: "by number",
              complete: false,
              value: "",
            });
          } else {
            // No tokens found
            setChat((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `⚠️ No tokens found for "${detectedSymbol}" on ${intent.chain}. Please try a different token symbol.`,
              },
            ]);
          }
        } else {
          // Handle unsupported intent types
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "⚠️ Only native ETH transfers on Base are supported in this MVP."
            },
          ]);
        }

        setAiResponding(false);
      } catch (err) {
        console.error("Intent parsing error:", err);

        let errorMessage = "⚠️ Error parsing your request.";

        if (err instanceof IntentParseError) {
          switch (err.code) {
            case "OFF_POLICY_JSON":
              errorMessage = `⚠️ ${err.message}`;
              break;
            case "MISSING_API_KEY":
              errorMessage = "⚠️ AI service not configured.";
              break;
            default:
              errorMessage = `⚠️ ${err.message}`;
          }
        }

        setChat((prev) => [
          ...prev,
          { role: "assistant", content: errorMessage },
        ]);
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
                  command: "ask-ai",
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
