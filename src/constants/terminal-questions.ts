import { QuestionType } from "@/types/terminal-types";

export const LOGIN_WITH_EMAIL_QUESTIONS: QuestionType[] = [
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
