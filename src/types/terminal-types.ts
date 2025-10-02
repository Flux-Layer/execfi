export type ChatContent =
   | string
   | {
      type: "token-table";
      message?: string;
      tokens: {
         id: number;
         chainId: number;
         address: string;
         name: string;
         symbol: string;
         logoURI?: string;
         verified?: boolean;
      }[];
   }
   | {
      type: "intent-summary";
      action: string;
      chain: string;
      token: string;
      amount: string;
      recipient: string;
   }
   | {
      type: "clarification";
      question: string;
      missing: string[];
   }
   | {
      type: "explorer-link";
      url: string;
      text: string;
      explorerName: string;
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
