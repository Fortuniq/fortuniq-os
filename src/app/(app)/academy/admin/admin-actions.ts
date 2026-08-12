"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// Managing what training content exists is restricted to Super Admin —
// deciding what every employee is trained on, and what counts as a
// passing score, isn't self-service for whoever has Academy access.
async function assertCallerIsAdmin() {
  const caller = await getCurrentUserPermissions();
  if (caller.status !== "active" || !caller.isAdmin) {
    throw new Error("Only a Super Admin can manage Academy content.");
  }
  return caller;
}

// ---------- SCHOOLS ----------
export async function addSchool(formData: FormData) {
  const caller = await assertCallerIsAdmin();
  const supabase = createServiceClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A school name is required.");

  await supabase.from("schools").insert({
    name,
    icon: String(formData.get("icon") ?? "🎓").trim() || "🎓",
    description: String(formData.get("description") ?? "").trim() || null,
    sort_order: Number(formData.get("sortOrder") ?? 99),
  });

  await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "document_status_changed", targetType: "school", targetLabel: name, metadata: { field: "school_created" } });
  revalidatePath("/academy");
  revalidatePath("/academy/admin");
}

export async function updateSchool(schoolId: string, formData: FormData) {
  await assertCallerIsAdmin();
  const supabase = createServiceClient();
  await supabase.from("schools").update({
    name: String(formData.get("name") ?? "").trim(),
    icon: String(formData.get("icon") ?? "🎓").trim() || "🎓",
    description: String(formData.get("description") ?? "").trim() || null,
    sort_order: Number(formData.get("sortOrder") ?? 99),
  }).eq("id", schoolId);
  revalidatePath("/academy");
  revalidatePath("/academy/admin");
}

// ---------- COURSES ----------
export async function addCourse(formData: FormData) {
  const caller = await assertCallerIsAdmin();
  const supabase = createServiceClient();
  const title = String(formData.get("title") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "");
  if (!title || !schoolId) throw new Error("A title and school are required.");

  await supabase.from("courses").insert({
    title,
    category: String(formData.get("category") ?? "General").trim(),
    school_id: schoolId,
    description: String(formData.get("description") ?? "").trim() || null,
    duration: String(formData.get("duration") ?? "").trim() || null,
    pass_mark_pct: Number(formData.get("passMarkPct") ?? 70),
    sort_order: Number(formData.get("sortOrder") ?? 99),
    modules: 0,
  });

  await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "document_status_changed", targetType: "course", targetLabel: title, metadata: { field: "course_created" } });
  revalidatePath("/academy");
  revalidatePath("/academy/admin");
}

export async function updateCourse(courseId: string, formData: FormData) {
  await assertCallerIsAdmin();
  const supabase = createServiceClient();
  await supabase.from("courses").update({
    title: String(formData.get("title") ?? "").trim(),
    category: String(formData.get("category") ?? "General").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    duration: String(formData.get("duration") ?? "").trim() || null,
    pass_mark_pct: Number(formData.get("passMarkPct") ?? 70),
  }).eq("id", courseId);
  revalidatePath("/academy");
  revalidatePath(`/academy/course/${courseId}`);
  revalidatePath("/academy/admin");
}

export async function deleteCourse(courseId: string) {
  const caller = await assertCallerIsAdmin();
  const supabase = createServiceClient();
  await supabase.from("courses").delete().eq("id", courseId);
  await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "document_status_changed", targetType: "course", targetId: courseId, metadata: { field: "course_deleted" } });
  revalidatePath("/academy");
  revalidatePath("/academy/admin");
}

// ---------- LESSONS ----------
export async function addLesson(courseId: string, formData: FormData) {
  await assertCallerIsAdmin();
  const supabase = createServiceClient();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) throw new Error("A lesson needs a title and content.");

  const { count } = await supabase.from("lessons").select("*", { count: "exact", head: true }).eq("course_id", courseId);

  await supabase.from("lessons").insert({
    course_id: courseId,
    title,
    content,
    video_url: String(formData.get("videoUrl") ?? "").trim() || null,
    duration_minutes: Number(formData.get("durationMinutes") ?? 5),
    sort_order: count ?? 0,
  });
  revalidatePath(`/academy/course/${courseId}`);
  revalidatePath("/academy/admin");
}

export async function updateLesson(lessonId: string, courseId: string, formData: FormData) {
  await assertCallerIsAdmin();
  const supabase = createServiceClient();
  await supabase.from("lessons").update({
    title: String(formData.get("title") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
    video_url: String(formData.get("videoUrl") ?? "").trim() || null,
    duration_minutes: Number(formData.get("durationMinutes") ?? 5),
  }).eq("id", lessonId);
  revalidatePath(`/academy/course/${courseId}`);
  revalidatePath("/academy/admin");
}

export async function deleteLesson(lessonId: string, courseId: string) {
  await assertCallerIsAdmin();
  const supabase = createServiceClient();
  await supabase.from("lessons").delete().eq("id", lessonId);
  revalidatePath(`/academy/course/${courseId}`);
  revalidatePath("/academy/admin");
}

// ---------- QUIZ QUESTIONS ----------
export async function addQuizQuestion(courseId: string, formData: FormData) {
  await assertCallerIsAdmin();
  const supabase = createServiceClient();
  const question = String(formData.get("question") ?? "").trim();
  const options = [0, 1, 2, 3].map((i) => String(formData.get(`option${i}`) ?? "").trim());
  if (!question || options.some((o) => !o)) throw new Error("A question and all 4 options are required.");

  const { count } = await supabase.from("quiz_questions").select("*", { count: "exact", head: true }).eq("course_id", courseId);

  await supabase.from("quiz_questions").insert({
    course_id: courseId,
    question,
    options,
    correct_option_index: Number(formData.get("correctOptionIndex") ?? 0),
    explanation: String(formData.get("explanation") ?? "").trim() || null,
    sort_order: count ?? 0,
  });
  revalidatePath(`/academy/course/${courseId}`);
  revalidatePath("/academy/admin");
}

export async function updateQuizQuestion(questionId: string, courseId: string, formData: FormData) {
  await assertCallerIsAdmin();
  const supabase = createServiceClient();
  const options = [0, 1, 2, 3].map((i) => String(formData.get(`option${i}`) ?? "").trim());
  await supabase.from("quiz_questions").update({
    question: String(formData.get("question") ?? "").trim(),
    options,
    correct_option_index: Number(formData.get("correctOptionIndex") ?? 0),
    explanation: String(formData.get("explanation") ?? "").trim() || null,
  }).eq("id", questionId);
  revalidatePath(`/academy/course/${courseId}`);
  revalidatePath("/academy/admin");
}

export async function deleteQuizQuestion(questionId: string, courseId: string) {
  await assertCallerIsAdmin();
  const supabase = createServiceClient();
  await supabase.from("quiz_questions").delete().eq("id", questionId);
  revalidatePath(`/academy/course/${courseId}`);
  revalidatePath("/academy/admin");
}

// ---------- FETCH FOR EDITING ----------
export async function fetchCourseAdminContent(courseId: string) {
  await assertCallerIsAdmin();
  const { getCourseAdminContent } = await import("@/lib/data");
  return getCourseAdminContent(courseId);
}
