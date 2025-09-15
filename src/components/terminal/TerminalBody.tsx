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

const QUESTIONS: QuestionType[] = [
  { key: "email", text: "To start, could you give us ", postfix: "your email?", complete: false, value: "" },
  { key: "code", text: "Enter the code sent to ", postfix: "your email", complete: false, value: "" },
];

// ✅ type hasil dari fetcher
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
  const { sendTx } = useZeroDevSA();
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
    if (curQuestion) {
      if (curQuestion?.key === "email") {
        sendCode({ email: value });
        setEmail(value);
      } else if (curQuestion?.key === "code") {
        loginWithCode({ code: value });
        setCode(value);
      } else if (curQuestion?.key === "token-address-selection") {
        setSelectedToken(tokenSelections?.find((t) => t?.id === Number(value)));
      }

      setQuestions((pv) =>
        pv.map((q, i) =>
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
        const res = await fetch("/api/prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: value }),
        });
        const data = await res.json();
        const detectedSymbol = data?.output?.[0]?.token?.symbol;

        // ✅ pastikan tokens di-cast ke TokenResponse
        const tokens: TokenResponse | null = detectedSymbol
          ? (await fetcher("", "/api/relay", {
              method: "POST",
              body: { chainIds: [8453], term: detectedSymbol, limit: 15 },
            } as any)) as TokenResponse
          : null;

        if (tokens && Array.isArray(tokens.data)) {
          // Simpan ke state selections
          setTokenSelections(tokens.data.map((t, i) => ({ id: i + 1, ...t })));

          // Simpan ke chat sebagai tabel
          setChat([
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

          // Tambah pertanyaan follow-up
          setQuestions([
            { key: "token-address-selection", text: "Choose the token ", postfix: "by number", complete: false, value: "" },
          ]);
          setCurQuestion({
            key: "token-address-selection",
            text: "Choose the token ",
            postfix: "by number",
            complete: false,
            value: "",
          });
        }

        // Simpan raw output AI juga
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
