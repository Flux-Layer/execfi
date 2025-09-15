export type ChatContent =
  | string
  | {
      type: "token-table";
      tokens: {
        id: number;
        chainId: number;
        address: string;
        name: string;
        symbol: string;
        logoURI?: string;
        verified?: boolean;
      }[];
    };

export type ChatMessage = {
  role: "user" | "assistant";
  content: ChatContent;
};

export type QuestionType = {
  key: string;
  text: string;
  postfix?: string;
  complete: boolean;
  value: string;
};

export interface CurrentLineProps {
  text: string;
  focused: boolean;
  setText: React.Dispatch<React.SetStateAction<string>>;
  setFocused: React.Dispatch<React.SetStateAction<boolean>>;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  command: string;
  handleSubmitLine: (line: string) => any;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  loading?: boolean;
}

export interface TerminalBodyProps {
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
}

export interface PreviousQuestionProps {
  questions: QuestionType[];
}

export interface CurrentQuestionProps {
  curQuestion: QuestionType | undefined;
}
