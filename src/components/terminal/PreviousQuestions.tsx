import { Fragment } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { PreviousQuestionProps } from "./types";

const PreviousQuestions = ({ questions }: PreviousQuestionProps) => {
  return (
    <>
      {questions.map((q, i) =>
        q.complete ? (
          <Fragment key={i}>
            <p>
              {q.text || ""}
              {q.postfix && <span className="text-violet-300">{q.postfix}</span>}
            </p>
            <p className="text-emerald-300">
              <FiCheckCircle className="inline-block mr-2" />
              <span>{q.value}</span>
            </p>
          </Fragment>
        ) : null
      )}
    </>
  );
};

export default PreviousQuestions;
