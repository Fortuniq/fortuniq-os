"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { scoreQuiz, type QuizAnswer } from "@/lib/academy-core";

export async function markLessonComplete(courseId: string, lessonId: string) {
  const permissions = await getCurrentUserPermissions();
  if (permissions.status !== "active" || !permissions.email) throw new Error("Not signed in.");

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("employee_course_progress")
    .select("*")
    .eq("employee_email", permissions.email)
    .eq("course_id", courseId)
    .maybeSingle();

  const completedLessonIds: string[] = existing?.completed_lesson_ids ?? [];
  if (!completedLessonIds.includes(lessonId)) completedLessonIds.push(lessonId);

  if (existing) {
    await supabase
      .from("employee_course_progress")
      .update({ completed_lesson_ids: completedLessonIds, status: "In Progress", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("employee_course_progress").insert({
      employee_email: permissions.email,
      course_id: courseId,
      status: "In Progress",
      completed_lesson_ids: completedLessonIds,
      started_at: new Date().toISOString(),
    });
  }

  revalidatePath(`/academy/course/${courseId}`);
}

/**
 * Scores a quiz submission using the REAL correct answers, fetched here
 * server-side — never trusting a "correct answer" the browser might send
 * back. This is the only place quiz_questions.correct_option_index is
 * ever read.
 */
export async function submitQuiz(courseId: string, answers: QuizAnswer[]) {
  const permissions = await getCurrentUserPermissions();
  if (permissions.status !== "active" || !permissions.email) throw new Error("Not signed in.");

  const supabase = createServiceClient();
  const [{ data: course }, { data: questions }] = await Promise.all([
    supabase.from("courses").select("pass_mark_pct, title").eq("id", courseId).maybeSingle(),
    supabase.from("quiz_questions").select("id, correct_option_index").eq("course_id", courseId),
  ]);

  if (!course || !questions) throw new Error("Course not found.");

  const result = scoreQuiz(
    questions.map((q) => ({ id: q.id, correctOptionIndex: q.correct_option_index })),
    answers,
    course.pass_mark_pct ?? 70
  );

  const { data: existing } = await supabase
    .from("employee_course_progress")
    .select("id")
    .eq("employee_email", permissions.email)
    .eq("course_id", courseId)
    .maybeSingle();

  const updates = {
    status: result.passed ? "Completed" : "In Progress",
    quiz_score_pct: result.scorePct,
    quiz_passed: result.passed,
    completed_at: result.passed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("employee_course_progress").update(updates).eq("id", existing.id);
  } else {
    await supabase.from("employee_course_progress").insert({
      employee_email: permissions.email, course_id: courseId, started_at: new Date().toISOString(), ...updates,
    });
  }

  // A passed course becomes a real certification on the employee's
  // profile — connecting Academy completion to the Employee Hub, exactly
  // as described in the original brief.
  if (result.passed) {
    const { data: employee } = await supabase.from("employees").select("id").eq("email", permissions.email).maybeSingle();
    if (employee) {
      const { data: alreadyCertified } = await supabase
        .from("employee_certifications")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("name", `${course.title} (FortunIQ Academy)`)
        .maybeSingle();
      if (!alreadyCertified) {
        await supabase.from("employee_certifications").insert({
          employee_id: employee.id,
          name: `${course.title} (FortunIQ Academy)`,
          issued_date: new Date().toISOString().slice(0, 10),
        });
      }
    }
  }

  revalidatePath(`/academy/course/${courseId}`);
  revalidatePath("/people");
  return result;
}
