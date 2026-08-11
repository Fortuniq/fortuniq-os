"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, PlayCircle, CheckCircle2, Circle, Clock, Award,
  Video, ClipboardCheck, CheckCircle, XCircle,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import type { CourseDetail } from "@/lib/data";
import { markLessonComplete, submitQuiz } from "../../academy-actions";

type Mode = { type: "lesson"; index: number } | { type: "quiz" } | { type: "quiz-result" };

export function CoursePlayerView({ course }: { course: CourseDetail }) {
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(course.progress.completedLessonIds);
  const [mode, setMode] = useState<Mode>({ type: "lesson", index: 0 });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ scorePct: number; correctCount: number; totalCount: number; passed: boolean } | null>(
    course.progress.quizScorePct !== null
      ? { scorePct: course.progress.quizScorePct, correctCount: 0, totalCount: course.quizQuestions.length, passed: !!course.progress.quizPassed }
      : null
  );

  const allLessonsComplete = course.lessons.every((l) => completedLessonIds.includes(l.id));

  async function handleCompleteLesson(lessonId: string) {
    if (!completedLessonIds.includes(lessonId)) {
      setCompletedLessonIds((ids) => [...ids, lessonId]);
      await markLessonComplete(course.id, lessonId);
    }
    const idx = course.lessons.findIndex((l) => l.id === lessonId);
    if (idx < course.lessons.length - 1) {
      setMode({ type: "lesson", index: idx + 1 });
    } else if (course.quizQuestions.length > 0) {
      setMode({ type: "quiz" });
    }
  }

  async function handleSubmitQuiz() {
    setSubmitting(true);
    try {
      const answerList = course.quizQuestions.map((q) => ({ questionId: q.id, selectedOptionIndex: answers[q.id] ?? -1 }));
      const res = await submitQuiz(course.id, answerList);
      setResult(res);
      setMode({ type: "quiz-result" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link href="/academy" className="flex items-center gap-1.5 text-sm text-grey hover:text-navy transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Academy
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-black text-navy">{course.title}</h1>
        {course.description && <p className="text-sm text-grey mt-1">{course.description}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar: lesson list */}
        <div className="lg:col-span-1 space-y-2">
          {course.lessons.map((lesson, i) => {
            const isComplete = completedLessonIds.includes(lesson.id);
            const isActive = mode.type === "lesson" && mode.index === i;
            return (
              <button
                key={lesson.id}
                onClick={() => setMode({ type: "lesson", index: i })}
                className={`w-full text-left p-3 rounded-lg border flex items-start gap-2.5 transition-colors ${
                  isActive ? "border-orange bg-orange/5" : "border-border bg-white hover:border-orange/40"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-light-grey shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-navy truncate">{i + 1}. {lesson.title}</p>
                  <p className="text-[10px] text-light-grey flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5" /> {lesson.durationMinutes} min
                  </p>
                </div>
              </button>
            );
          })}
          {course.quizQuestions.length > 0 && (
            <button
              onClick={() => allLessonsComplete && setMode({ type: "quiz" })}
              disabled={!allLessonsComplete}
              className={`w-full text-left p-3 rounded-lg border flex items-center gap-2.5 transition-colors ${
                mode.type === "quiz" || mode.type === "quiz-result" ? "border-orange bg-orange/5" : "border-border bg-white"
              } ${!allLessonsComplete ? "opacity-40 cursor-not-allowed" : "hover:border-orange/40"}`}
            >
              <ClipboardCheck className="w-4 h-4 text-orange shrink-0" />
              <div>
                <p className="text-xs font-semibold text-navy">Assessment</p>
                <p className="text-[10px] text-light-grey">{course.quizQuestions.length} questions</p>
              </div>
            </button>
          )}
        </div>

        {/* Main content area */}
        <div className="lg:col-span-3">
          {mode.type === "lesson" && (
            <LessonPanel
              lesson={course.lessons[mode.index]}
              onComplete={() => handleCompleteLesson(course.lessons[mode.index].id)}
              isLast={mode.index === course.lessons.length - 1}
              hasQuiz={course.quizQuestions.length > 0}
            />
          )}

          {mode.type === "quiz" && (
            <QuizPanel
              questions={course.quizQuestions}
              answers={answers}
              onAnswer={(qId, idx) => setAnswers((a) => ({ ...a, [qId]: idx }))}
              onSubmit={handleSubmitQuiz}
              submitting={submitting}
            />
          )}

          {mode.type === "quiz-result" && result && (
            <ResultPanel result={result} passMarkPct={course.passMarkPct} courseTitle={course.title} onRetake={() => { setAnswers({}); setMode({ type: "quiz" }); }} />
          )}
        </div>
      </div>
    </div>
  );
}

function LessonPanel({ lesson, onComplete, isLast, hasQuiz }: { lesson: CourseDetail["lessons"][number]; onComplete: () => void; isLast: boolean; hasQuiz: boolean }) {
  return (
    <Card>
      {/* Video-ready area: shows a real video if one's been added, otherwise
          a clean placeholder — the layout is identical either way, so
          adding a real video later needs no redesign. */}
      {lesson.videoUrl ? (
        <div className="aspect-video bg-navy rounded-t-xl overflow-hidden">
          <video src={lesson.videoUrl} controls className="w-full h-full" />
        </div>
      ) : (
        <div className="aspect-video bg-navy rounded-t-xl flex flex-col items-center justify-center gap-2">
          <Video className="w-10 h-10 text-white/20" />
          <p className="text-white/40 text-xs">Video coming soon — reading lesson below</p>
        </div>
      )}

      <CardBody className="pt-5">
        <h2 className="font-display text-lg font-bold text-navy mb-3">{lesson.title}</h2>
        <div className="prose prose-sm max-w-none text-sm text-navy leading-relaxed whitespace-pre-line">
          {lesson.content}
        </div>
        <button
          onClick={onComplete}
          className="mt-6 flex items-center gap-2 bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-orange transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
          {isLast ? (hasQuiz ? "Mark Complete & Start Assessment" : "Mark Complete") : "Mark Complete & Continue"}
        </button>
      </CardBody>
    </Card>
  );
}

function QuizPanel({
  questions, answers, onAnswer, onSubmit, submitting,
}: {
  questions: CourseDetail["quizQuestions"];
  answers: Record<string, number>;
  onAnswer: (questionId: string, index: number) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center gap-2 mb-5">
          <ClipboardCheck className="w-5 h-5 text-orange" />
          <h2 className="font-display text-lg font-bold text-navy">Assessment</h2>
        </div>
        <div className="space-y-6">
          {questions.map((q, qi) => (
            <div key={q.id}>
              <p className="text-sm font-semibold text-navy mb-2">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                      answers[q.id] === oi ? "border-orange bg-orange/5" : "border-border hover:border-orange/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === oi}
                      onChange={() => onAnswer(q.id, oi)}
                      className="w-4 h-4 accent-orange"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onSubmit}
          disabled={!allAnswered || submitting}
          className="mt-6 bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Submit Assessment"}
        </button>
        {!allAnswered && <p className="text-xs text-light-grey mt-2">Answer every question to submit.</p>}
      </CardBody>
    </Card>
  );
}

function ResultPanel({
  result, passMarkPct, courseTitle, onRetake,
}: {
  result: { scorePct: number; correctCount: number; totalCount: number; passed: boolean };
  passMarkPct: number;
  courseTitle: string;
  onRetake: () => void;
}) {
  return (
    <Card>
      <CardBody className="pt-8 pb-8 text-center">
        {result.passed ? (
          <>
            <Award className="w-14 h-14 text-orange mx-auto mb-3" />
            <h2 className="font-display text-xl font-black text-navy mb-1">Course Complete!</h2>
            <p className="text-sm text-grey mb-4">
              You scored <strong className="text-navy">{result.scorePct}%</strong> — a certificate for
              &ldquo;{courseTitle}&rdquo; has been added to your Employee Hub profile.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" /> Passed (pass mark: {passMarkPct}%)
            </div>
          </>
        ) : (
          <>
            <XCircle className="w-14 h-14 text-amber-500 mx-auto mb-3" />
            <h2 className="font-display text-xl font-black text-navy mb-1">Not Quite There</h2>
            <p className="text-sm text-grey mb-4">
              You scored <strong className="text-navy">{result.scorePct}%</strong> — you need {passMarkPct}% to pass.
              Review the lessons and try again.
            </p>
            <button
              onClick={onRetake}
              className="bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-orange transition-colors"
            >
              Retake Assessment
            </button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
