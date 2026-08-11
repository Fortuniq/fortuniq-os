// Pure quiz-scoring logic — zero dependencies on Next.js, Auth.js, or
// Supabase, same reasoning as the rest of the security-critical modules
// in this app: fully unit-testable in isolation. See
// src/lib/academy-core.test.ts.

export type QuizQuestion = {
  id: string;
  correctOptionIndex: number;
};

export type QuizAnswer = {
  questionId: string;
  selectedOptionIndex: number;
};

export type QuizResult = {
  scorePct: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
};

/**
 * Scores a completed quiz attempt against the correct answers, and
 * determines pass/fail against the course's pass mark. Deliberately pure
 * and synchronous — the actual quiz questions and their correct answers
 * are fetched server-side beforehand; this function never needs to know
 * where they came from, which is what makes it trivial to test.
 */
export function scoreQuiz(questions: QuizQuestion[], answers: QuizAnswer[], passMarkPct: number): QuizResult {
  if (questions.length === 0) {
    return { scorePct: 0, correctCount: 0, totalCount: 0, passed: false };
  }

  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a.selectedOptionIndex]));
  let correctCount = 0;
  for (const q of questions) {
    if (answerByQuestion.get(q.id) === q.correctOptionIndex) {
      correctCount++;
    }
  }

  const scorePct = Math.round((correctCount / questions.length) * 100);
  return {
    scorePct,
    correctCount,
    totalCount: questions.length,
    passed: scorePct >= passMarkPct,
  };
}
