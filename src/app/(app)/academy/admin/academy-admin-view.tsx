"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil, X, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import type { AdminSchool, AdminCourse, AdminLesson, AdminQuizQuestion } from "@/lib/data";
import {
  addSchool, updateSchool, addCourse, updateCourse, deleteCourse,
  addLesson, updateLesson, deleteLesson,
  addQuizQuestion, updateQuizQuestion, deleteQuizQuestion,
  fetchCourseAdminContent,
} from "./admin-actions";

export function AcademyAdminView({ schools, courses }: { schools: AdminSchool[]; courses: AdminCourse[] }) {
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editingSchool, setEditingSchool] = useState<AdminSchool | null>(null);
  const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Link href="/academy" className="flex items-center gap-1.5 text-sm text-grey hover:text-navy transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Academy
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-black text-navy">Manage Academy Content</h1>
        <p className="text-sm text-grey mt-1">Add and edit Schools, Courses, Lessons, and Assessments. Super Admin only.</p>
      </div>

      {/* SCHOOLS */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Schools</CardTitle>
            <button onClick={() => setShowAddSchool((s) => !s)} className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add School
            </button>
          </div>
        </CardHeader>
        <CardBody>
          {showAddSchool && (
            <SchoolForm
              onSubmit={(fd) => startTransition(async () => { await addSchool(fd); setShowAddSchool(false); })}
              onCancel={() => setShowAddSchool(false)}
              submitting={isPending}
            />
          )}
          {editingSchool && (
            <SchoolForm
              school={editingSchool}
              onSubmit={(fd) => startTransition(async () => { await updateSchool(editingSchool.id, fd); setEditingSchool(null); })}
              onCancel={() => setEditingSchool(null)}
              submitting={isPending}
            />
          )}
          <div className="divide-y divide-border">
            {schools.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="text-xl">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">{s.name}</p>
                  <p className="text-xs text-light-grey truncate">{s.description}</p>
                </div>
                <button onClick={() => setEditingSchool(s)} className="text-grey hover:text-navy transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* COURSES */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Courses</CardTitle>
            <button onClick={() => setShowAddCourse((s) => !s)} className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Course
            </button>
          </div>
        </CardHeader>
        <CardBody>
          {showAddCourse && (
            <CourseForm
              schools={schools}
              onSubmit={(fd) => startTransition(async () => { await addCourse(fd); setShowAddCourse(false); })}
              onCancel={() => setShowAddCourse(false)}
              submitting={isPending}
            />
          )}
          {editingCourse && (
            <CourseForm
              course={editingCourse}
              schools={schools}
              onSubmit={(fd) => startTransition(async () => { await updateCourse(editingCourse.id, fd); setEditingCourse(null); })}
              onCancel={() => setEditingCourse(null)}
              submitting={isPending}
            />
          )}
          <div className="divide-y divide-border">
            {courses.map((c) => (
              <div key={c.id}>
                <div className="flex items-center gap-3 py-2.5">
                  <button onClick={() => setExpandedCourseId(expandedCourseId === c.id ? null : c.id)} className="text-grey hover:text-navy transition-colors shrink-0">
                    {expandedCourseId === c.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy">{c.title}</p>
                    <p className="text-xs text-light-grey">{c.schoolName} · pass mark {c.passMarkPct}%</p>
                  </div>
                  <button onClick={() => setEditingCourse(c)} className="text-grey hover:text-navy transition-colors" title="Edit course details">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${c.title}" and all its lessons/questions?`)) startTransition(() => deleteCourse(c.id)); }}
                    className="text-grey hover:text-red-600 transition-colors"
                    title="Delete course"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {expandedCourseId === c.id && <CourseContentEditor courseId={c.id} />}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function SchoolForm({ school, onSubmit, onCancel, submitting }: { school?: AdminSchool; onSubmit: (fd: FormData) => void; onCancel: () => void; submitting: boolean }) {
  return (
    <form action={onSubmit} className="bg-surface rounded-lg p-4 mb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input name="icon" defaultValue={school?.icon ?? "🎓"} placeholder="Icon" className="text-sm px-3 py-2 rounded-lg border border-border" />
        <input name="name" defaultValue={school?.name} placeholder="School name" required className="text-sm px-3 py-2 rounded-lg border border-border sm:col-span-3" />
      </div>
      <input name="description" defaultValue={school?.description ?? ""} placeholder="Description" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
      <input name="sortOrder" type="number" defaultValue={school?.sortOrder ?? 99} placeholder="Sort order" className="w-32 text-sm px-3 py-2 rounded-lg border border-border" />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">Save</button>
        <button type="button" onClick={onCancel} className="text-sm text-grey px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}

function CourseForm({ course, schools, onSubmit, onCancel, submitting }: { course?: AdminCourse; schools: AdminSchool[]; onSubmit: (fd: FormData) => void; onCancel: () => void; submitting: boolean }) {
  return (
    <form action={onSubmit} className="bg-surface rounded-lg p-4 mb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input name="title" defaultValue={course?.title} placeholder="Course title" required className="text-sm px-3 py-2 rounded-lg border border-border" />
        {!course && (
          <select name="schoolId" required className="text-sm px-3 py-2 rounded-lg border border-border">
            <option value="">Choose a school…</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {course && <input name="category" defaultValue={course.title} className="hidden" />}
      </div>
      <input name="description" defaultValue={course?.description ?? ""} placeholder="Description" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <input name="duration" defaultValue={course?.duration ?? ""} placeholder="Duration (e.g. 15 min)" className="text-sm px-3 py-2 rounded-lg border border-border" />
        <input name="passMarkPct" type="number" min={0} max={100} defaultValue={course?.passMarkPct ?? 70} placeholder="Pass mark %" className="text-sm px-3 py-2 rounded-lg border border-border" />
        {!course && <input name="sortOrder" type="number" defaultValue={99} placeholder="Sort order" className="text-sm px-3 py-2 rounded-lg border border-border" />}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">Save</button>
        <button type="button" onClick={onCancel} className="text-sm text-grey px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}

function CourseContentEditor({ courseId }: { courseId: string }) {
  const [lessons, setLessons] = useState<AdminLesson[] | null>(null);
  const [questions, setQuestions] = useState<AdminQuizQuestion[] | null>(null);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<AdminLesson | null>(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuizQuestion | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reload() {
    const content = await fetchCourseAdminContent(courseId);
    setLessons(content.lessons);
    setQuestions(content.quizQuestions);
  }

  if (lessons === null) {
    reload();
    return <p className="text-xs text-light-grey pl-9 py-3">Loading…</p>;
  }

  return (
    <div className="pl-9 pb-4 space-y-4">
      {/* Lessons */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-grey">Lessons</p>
          <button onClick={() => setShowAddLesson((s) => !s)} className="flex items-center gap-1 text-xs text-orange font-semibold">
            <Plus className="w-3 h-3" /> Add lesson
          </button>
        </div>
        {showAddLesson && (
          <LessonForm
            onSubmit={(fd) => startTransition(async () => { await addLesson(courseId, fd); setShowAddLesson(false); await reload(); })}
            onCancel={() => setShowAddLesson(false)}
            submitting={isPending}
          />
        )}
        {editingLesson && (
          <LessonForm
            lesson={editingLesson}
            onSubmit={(fd) => startTransition(async () => { await updateLesson(editingLesson.id, courseId, fd); setEditingLesson(null); await reload(); })}
            onCancel={() => setEditingLesson(null)}
            submitting={isPending}
          />
        )}
        <div className="space-y-1.5">
          {lessons.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-sm bg-white border border-border rounded-lg px-3 py-2">
              <span className="flex-1 truncate text-navy">{l.title}</span>
              <span className="text-xs text-light-grey shrink-0">{l.durationMinutes} min</span>
              <button onClick={() => setEditingLesson(l)} className="text-grey hover:text-navy shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
              <button
                onClick={() => { if (confirm("Delete this lesson?")) startTransition(async () => { await deleteLesson(l.id, courseId); await reload(); }); }}
                className="text-grey hover:text-red-600 shrink-0"
              ><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {lessons.length === 0 && <p className="text-xs text-light-grey">No lessons yet.</p>}
        </div>
      </div>

      {/* Quiz Questions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-grey">Assessment Questions</p>
          <button onClick={() => setShowAddQuestion((s) => !s)} className="flex items-center gap-1 text-xs text-orange font-semibold">
            <Plus className="w-3 h-3" /> Add question
          </button>
        </div>
        {showAddQuestion && (
          <QuestionForm
            onSubmit={(fd) => startTransition(async () => { await addQuizQuestion(courseId, fd); setShowAddQuestion(false); await reload(); })}
            onCancel={() => setShowAddQuestion(false)}
            submitting={isPending}
          />
        )}
        {editingQuestion && (
          <QuestionForm
            questionData={editingQuestion}
            onSubmit={(fd) => startTransition(async () => { await updateQuizQuestion(editingQuestion.id, courseId, fd); setEditingQuestion(null); await reload(); })}
            onCancel={() => setEditingQuestion(null)}
            submitting={isPending}
          />
        )}
        <div className="space-y-1.5">
          {(questions ?? []).map((q) => (
            <div key={q.id} className="flex items-center gap-2 text-sm bg-white border border-border rounded-lg px-3 py-2">
              <span className="flex-1 truncate text-navy">{q.question}</span>
              <span className="text-xs text-emerald-600 shrink-0">✓ {q.options[q.correctOptionIndex]}</span>
              <button onClick={() => setEditingQuestion(q)} className="text-grey hover:text-navy shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
              <button
                onClick={() => { if (confirm("Delete this question?")) startTransition(async () => { await deleteQuizQuestion(q.id, courseId); await reload(); }); }}
                className="text-grey hover:text-red-600 shrink-0"
              ><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {(questions ?? []).length === 0 && <p className="text-xs text-light-grey">No questions yet.</p>}
        </div>
      </div>
    </div>
  );
}

function LessonForm({ lesson, onSubmit, onCancel, submitting }: { lesson?: AdminLesson; onSubmit: (fd: FormData) => void; onCancel: () => void; submitting: boolean }) {
  return (
    <form action={onSubmit} className="bg-surface rounded-lg p-3 mb-3 space-y-2">
      <input name="title" defaultValue={lesson?.title} placeholder="Lesson title" required className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
      <textarea name="content" defaultValue={lesson?.content} placeholder="Lesson content" required rows={5} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
      <div className="flex gap-3">
        <input name="videoUrl" defaultValue={lesson?.videoUrl ?? ""} placeholder="Video URL (optional)" className="flex-1 text-sm px-3 py-2 rounded-lg border border-border" />
        <input name="durationMinutes" type="number" defaultValue={lesson?.durationMinutes ?? 5} placeholder="Minutes" className="w-24 text-sm px-3 py-2 rounded-lg border border-border" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">Save</button>
        <button type="button" onClick={onCancel} className="text-xs text-grey px-3 py-1.5">Cancel</button>
      </div>
    </form>
  );
}

function QuestionForm({ questionData, onSubmit, onCancel, submitting }: { questionData?: AdminQuizQuestion; onSubmit: (fd: FormData) => void; onCancel: () => void; submitting: boolean }) {
  const [correctIndex, setCorrectIndex] = useState(questionData?.correctOptionIndex ?? 0);
  return (
    <form action={onSubmit} className="bg-surface rounded-lg p-3 mb-3 space-y-2">
      <input name="question" defaultValue={questionData?.question} placeholder="Question" required className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" name="correctRadio" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} className="w-4 h-4 accent-orange shrink-0" />
          <input name={`option${i}`} defaultValue={questionData?.options?.[i]} placeholder={`Option ${i + 1}`} required className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-border" />
        </div>
      ))}
      <input type="hidden" name="correctOptionIndex" value={correctIndex} />
      <input name="explanation" defaultValue={questionData?.explanation ?? ""} placeholder="Explanation (shown after answering)" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">Save</button>
        <button type="button" onClick={onCancel} className="text-xs text-grey px-3 py-1.5">Cancel</button>
      </div>
    </form>
  );
}
