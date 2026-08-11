import { describe, it, expect } from "vitest";
import { scoreQuiz, type QuizQuestion, type QuizAnswer } from "./academy-core";

const questions: QuizQuestion[] = [
  { id: "q1", correctOptionIndex: 1 },
  { id: "q2", correctOptionIndex: 2 },
  { id: "q3", correctOptionIndex: 0 },
  { id: "q4", correctOptionIndex: 3 },
  { id: "q5", correctOptionIndex: 1 },
];

describe("scoreQuiz", () => {
  it("scores a perfect attempt as 100% and passed", () => {
    const answers: QuizAnswer[] = questions.map((q) => ({ questionId: q.id, selectedOptionIndex: q.correctOptionIndex }));
    const result = scoreQuiz(questions, answers, 70);
    expect(result).toEqual({ scorePct: 100, correctCount: 5, totalCount: 5, passed: true });
  });

  it("scores a completely wrong attempt as 0% and failed", () => {
    const answers: QuizAnswer[] = questions.map((q) => ({ questionId: q.id, selectedOptionIndex: (q.correctOptionIndex + 1) % 4 }));
    const result = scoreQuiz(questions, answers, 70);
    expect(result).toEqual({ scorePct: 0, correctCount: 0, totalCount: 5, passed: false });
  });

  it("correctly computes a partial score", () => {
    // 4 out of 5 correct = 80%
    const answers: QuizAnswer[] = [
      { questionId: "q1", selectedOptionIndex: 1 }, // correct
      { questionId: "q2", selectedOptionIndex: 2 }, // correct
      { questionId: "q3", selectedOptionIndex: 0 }, // correct
      { questionId: "q4", selectedOptionIndex: 3 }, // correct
      { questionId: "q5", selectedOptionIndex: 0 }, // wrong (correct is 1)
    ];
    const result = scoreQuiz(questions, answers, 70);
    expect(result.scorePct).toBe(80);
    expect(result.correctCount).toBe(4);
    expect(result.passed).toBe(true);
  });

  it("respects the course's specific pass mark, not a hardcoded value", () => {
    const answers: QuizAnswer[] = [
      { questionId: "q1", selectedOptionIndex: 1 },
      { questionId: "q2", selectedOptionIndex: 2 },
      { questionId: "q3", selectedOptionIndex: 0 },
      { questionId: "q4", selectedOptionIndex: 0 }, // wrong
      { questionId: "q5", selectedOptionIndex: 0 }, // wrong
    ];
    // 3/5 = 60%
    expect(scoreQuiz(questions, answers, 70).passed).toBe(false);
    expect(scoreQuiz(questions, answers, 50).passed).toBe(true);
  });

  it("treats an unanswered question as incorrect, not as an error", () => {
    const answers: QuizAnswer[] = [
      { questionId: "q1", selectedOptionIndex: 1 },
      { questionId: "q2", selectedOptionIndex: 2 },
      { questionId: "q3", selectedOptionIndex: 0 },
      { questionId: "q4", selectedOptionIndex: 3 },
      // q5 deliberately missing
    ];
    const result = scoreQuiz(questions, answers, 70);
    expect(result.correctCount).toBe(4);
    expect(result.scorePct).toBe(80);
  });

  it("handles a course with no quiz questions gracefully rather than dividing by zero", () => {
    const result = scoreQuiz([], [], 70);
    expect(result).toEqual({ scorePct: 0, correctCount: 0, totalCount: 0, passed: false });
  });

  it("a score exactly at the pass mark counts as passed", () => {
    const twoQuestions: QuizQuestion[] = [{ id: "a", correctOptionIndex: 0 }, { id: "b", correctOptionIndex: 0 }];
    const oneCorrect: QuizAnswer[] = [{ questionId: "a", selectedOptionIndex: 0 }, { questionId: "b", selectedOptionIndex: 1 }];
    // 1/2 = 50%
    expect(scoreQuiz(twoQuestions, oneCorrect, 50).passed).toBe(true);
  });
});
