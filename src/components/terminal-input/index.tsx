"use client";

import { motion } from "framer-motion";
import { FiCheckCircle } from "react-icons/fi";
import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  Fragment,
  MutableRefObject,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePrivyEOA } from "../../hooks/usePrivyEOA";
import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import PageBarLoader from "../loader";
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
const TerminalContact = () => {
  const { ready } = usePrivy();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section
      style={{
        backgroundImage:
          "url(https://images.unsplash.com/photo-1482686115713-0fbcaced6e28?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1734&q=80)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      className="px-4 py-12 bg-violet-600"
    >
      {ready ? (
        <div
          ref={containerRef}
          onClick={() => {
            inputRef.current?.focus();
          }}
          className="h-96 bg-slate-950/70 backdrop-blur rounded-lg w-full max-w-3xl mx-auto overflow-y-scroll shadow-xl cursor-text font-mono"
        >
          <TerminalHeader headerTitle="Kentank" />
          <TerminalBody inputRef={inputRef} containerRef={containerRef} />
        </div>
      ) : (
        <PageBarLoader />
      )}
    </section>
  );
};

const TerminalHeader = ({ headerTitle }: { headerTitle: string }) => {
  return (
    <div className="w-full p-3 bg-slate-900 flex items-center gap-1 sticky top-0">
      <span className="text-sm text-slate-200 font-semibold absolute left-[50%] -translate-x-[50%]">
        {headerTitle || ""}
      </span>
    </div>
  );
};

const TerminalBody = ({ containerRef, inputRef }: TerminalBodyProps) => {
  const { authenticated, ready } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");

  const [questions, setQuestions] = useState(QUESTIONS);
  const [chat, setChat] = useState<ChatMessage[]>([]); // state chat AI

  const [curQuestion, setCurQuestion] = useState<any>([
    questions.find((q) => !q.complete),
  ]);

  useEffect(() => {
    if (ready && authenticated && questions?.length) {
      console.log("HERE?");
      setQuestions([]);
      setCurQuestion("");
    } else if (ready && !authenticated && questions?.length) {
      setQuestions(QUESTIONS);
      setCurQuestion(QUESTIONS?.[0]);
    }
  }, [ready, authenticated]);

  const [aiResponding, setAiResponding] = useState(false);

  const handleSubmitLine = async (value: string) => {
    console.log({ curQuestion });
    if (curQuestion) {
      if (curQuestion?.key === "email") {
        sendCode({ email: value });
        setEmail(value);
      } else if (curQuestion?.key === "code") {
        loginWithCode({ code: value });
        setCode(code);
      }
      let nextQuestion;
      setQuestions((pv) =>
        pv.map((q, i) => {
          if (q.key === curQuestion.key) {
            nextQuestion = pv[i + 1];
            setCurQuestion(nextQuestion);
            console.log({ nextQuestion });
            return {
              ...q,
              complete: true,
              value,
            };
          }
          return q;
        }),
      );
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
        setChat((prev) => [
          ...prev,
          { role: "assistant", content: data.output },
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
            <CurLine
              text={text}
              focused={focused}
              setText={setText}
              setFocused={setFocused}
              inputRef={inputRef}
              command={curQuestion?.key || ""}
              handleSubmitLine={handleSubmitLine}
              containerRef={containerRef}
            />
          ) : authenticated ? (
            <>
              <ChatHistory chat={chat} />

              <CurLine
                text={text}
                focused={focused}
                setText={setText}
                setFocused={setFocused}
                inputRef={inputRef}
                command="ask-ai"
                handleSubmitLine={handleSubmitLine}
                containerRef={containerRef}
                loading={aiResponding}
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

const InitialText = () => {
  const { authenticated, user } = usePrivy();

  return (
    <>
      {!authenticated ? (
        <>
          <p>
            👋 Hey there! Let’s{" "}
            <span className="text-blue-200">get you connected.</span>
          </p>
          <p className="whitespace-nowrap overflow-hidden font-light">
            ------------------------------------------------------------------------
          </p>
        </>
      ) : (
        <>
          <p>
            🔓 <span className="text-blue-200">Access</span> granted.
          </p>
          <p className="whitespace-nowrap overflow-hidden font-light">
            ------------------------------------------------------------------------
          </p>
          <p>Logged in with email, {String(user?.email?.address || "")}.</p>
        </>
      )}
    </>
  );
};

const ChatHistory = ({ chat }: { chat: ChatMessage[] }) => {
  return (
    <div className="mt-4">
      {chat.map((c, i) => (
        <p
          key={i}
          className={
            c.role === "assistant" ? "text-emerald-300" : "text-cyan-300"
          }
        >
          {c.role === "assistant" ? "🤖 " : "🧑 "} {c.content}
        </p>
      ))}
    </div>
  );
};

const PreviousQuestions = ({ questions }: PreviousQuestionProps) => {
  return (
    <>
      {questions.map((q, i) => {
        if (q.complete) {
          return (
            <Fragment key={i}>
              <p>
                {q.text || ""}
                {q.postfix && (
                  <span className="text-violet-300">{q.postfix}</span>
                )}
              </p>
              <p className="text-emerald-300">
                <FiCheckCircle className="inline-block mr-2" />
                <span>{q.value}</span>
              </p>
            </Fragment>
          );
        }
        return <Fragment key={i}></Fragment>;
      })}
    </>
  );
};

const CurrentQuestion = ({ curQuestion }: CurrentQuestionProps) => {
  if (!curQuestion) return <></>;

  return (
    <p>
      {curQuestion.text || ""}
      {curQuestion.postfix && (
        <span className="text-violet-300">{curQuestion.postfix}</span>
      )}
    </p>
  );
};

const CurLine = ({
  text,
  focused,
  setText,
  setFocused,
  inputRef,
  command,
  handleSubmitLine,
  containerRef,
  loading,
}: CurrentLineProps) => {
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmitLine(text);
    setText("");
    setTimeout(() => {
      scrollToBottom();
    }, 0);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    scrollToBottom();
  };

  useEffect(() => {
    return () => setFocused(false);
  }, []);

  useEffect(() => {
    if (!loading) setFocused(true);
    inputRef.current?.focus()
  }, [loading]);

  return (
    <>
      <form onSubmit={onSubmit}>
        {loading ? (
          <PageBarLoader />
        ) : (
          <input
            ref={inputRef}
            onChange={onChange}
            value={text}
            type="text"
            className="sr-only"
            autoComplete="off"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        )}
      </form>
      {
         !loading && (
            <p>
            <span className="text-emerald-400">➜</span>{" "}
            <span className="text-cyan-300">~</span>{" "}
            {command && <span className="opacity-50">Enter {command}: </span>}
            {text}
            {focused && (
               <motion.span
               animate={{ opacity: [1, 1, 0, 0] }}
               transition={{
                  repeat: Infinity,
                  duration: 1,
                  ease: "linear",
                  times: [0, 0.5, 0.5, 1],
               }}
               className="inline-block w-2 h-5 bg-slate-400 translate-y-1 ml-0.5"
               />
            )}
            </p>

         )
      }
    </>
  );
};

export default TerminalContact;

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

interface CurrentLineProps {
  text: string;
  focused: boolean;
  setText: Dispatch<SetStateAction<string>>;
  setFocused: Dispatch<SetStateAction<boolean>>;
  inputRef: MutableRefObject<HTMLInputElement | null>;
  command: string;
  handleSubmitLine: (line: string) => any;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  loading?: boolean;
}

type QuestionType = {
  key: string;
  text: string;
  postfix?: string;
  complete: boolean;
  value: string;
};

interface TerminalBodyProps {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  inputRef: MutableRefObject<HTMLInputElement | null>;
}

interface PreviousQuestionProps {
  questions: QuestionType[];
}

interface SummaryProps {
  questions: QuestionType[];
  setQuestions: Dispatch<SetStateAction<QuestionType[]>>;
}

interface CurrentQuestionProps {
  curQuestion: QuestionType | undefined;
}
