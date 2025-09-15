import { motion } from "framer-motion";
import { FormEvent, ChangeEvent, useEffect } from "react";
import PageBarLoader from "@components/loader";
import { CurrentLineProps } from "./types";

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
    setTimeout(scrollToBottom, 0);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    scrollToBottom();
  };

  useEffect(() => () => setFocused(false), []);
  useEffect(() => {
    if (!loading) setFocused(true);
    inputRef.current?.focus();
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
      {!loading && (
        <p>
          <span className="text-emerald-400">➜</span>{" "}
          <span className="text-cyan-300">~</span>{" "}
          {command && <span className="opacity-50">Enter {command}: </span>}
          {text}
          {focused && (
            <motion.span
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="inline-block w-2 h-5 bg-slate-400 translate-y-1 ml-0.5"
            />
          )}
        </p>
      )}
    </>
  );
};

export default CurLine;
