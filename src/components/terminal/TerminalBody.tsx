import { useEffect, useState } from "react";
import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import PageBarLoader from "@components/loader";
import useZeroDevSA from "@/hooks/useZeroDevSA";
import { fetcher } from "@/lib/utils/fetcher";
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
import { formatUnits } from "viem";

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
  const { saAddress } = useZeroDevSA();
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

    const balance = parseFloat(
      formatUnits(balanceQuery.data.value, balanceQuery.data.decimals)
    );

    console.log("🔎 Selected token:", selectedToken);
    console.log("🔎 Balance raw:", balanceQuery.data.value.toString());
    console.log("🔎 Decimals:", balanceQuery.data.decimals);
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
          content: `⚠️ Insufficient balance. You only have ${balance} ${selectedToken.symbol}, but you want to send ${transferAmount}.`,
        },
      ]);
    } else if (transferAmount !== null) {
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ You have ${balance} ${selectedToken.symbol}, enough to send ${transferAmount}.`,
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
        setSelectedToken(token); // cek saldo akan jalan otomatis
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
      // user prompt ke AI
      setChat((prev) => [...prev, { role: "user", content: value }]);
      setText("");

      try {
        setAiResponding(true);
        const res = await fetch("/api/prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: value }),
        });
        const data = await res.json();

        const detectedSymbol = data?.output?.[0]?.token?.symbol;
        const detectedAmount = data?.output?.[0]?.amount;
        const detectedRecipient = data?.output?.[0]?.recipient;

        setTransferAmount(
          detectedAmount !== undefined && detectedAmount !== null
            ? Number(detectedAmount)
            : null
        );
        setTransferRecipient(detectedRecipient || "");

        const tokens: TokenResponse | null = detectedSymbol
          ? (await fetcher("", "/api/relay", {
              method: "POST",
              body: { chainIds: [8453], term: detectedSymbol, limit: 15 },
            } as any)) as TokenResponse
          : null;

        if (tokens && Array.isArray(tokens.data)) {
          setTokenSelections(tokens.data.map((t, i) => ({ id: i + 1, ...t })));

          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              content: {
                type: "token-table",
                tokens: tokens.data.map((t, i) => ({
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
        }

        // tambahin raw output AI juga, tapi append
        setChat((prev) => [
          ...prev,
          { role: "assistant", content: JSON.stringify(data.output) },
        ]);

        setAiResponding(false);
      } catch (err) {
        setChat((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Error connecting to AI" },
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
