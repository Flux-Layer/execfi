import { CurrentQuestionProps } from "@/types/terminal-types";

const CurrentQuestion = ({ curQuestion }: CurrentQuestionProps) => {
  if (!curQuestion) return null;

  return (
    <p>
      {curQuestion.text || ""}
      {curQuestion.postfix && (
        <span className="text-violet-300">{curQuestion.postfix}</span>
      )}
    </p>
  );
};

export default CurrentQuestion;
