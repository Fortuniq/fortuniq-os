"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getEmployeeByEmail } from "@/lib/data";
import { createPerformanceReview, updateCareerDevelopment } from "@/lib/performance";
import { canManagerAccessTeamMember } from "@/lib/hcm-core";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

type ActionResult = { error?: string };

/**
 * Creates a performance review for an employee — HR/Super Admin can
 * review anyone; a Manager can only review their own direct reports,
 * enforced server-side via canManagerAccessTeamMember(), matching the
 * brief's "Manager: Create Performance Reviews" scoped to their team,
 * never the whole company.
 */
export async function createPerformanceReviewAction(formData: FormData): Promise<ActionResult> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.email) return { error: "You need to be signed in." };

    const employeeId = String(formData.get("employeeId") ?? "");
    if (!employeeId) return { error: "Missing employee." };

    const isHR = permissions.isAdmin || permissions.role === "HR/Admin";
    if (!isHR) {
      const viewerEmployee = await getEmployeeByEmail(permissions.email);
      const supabase = createServiceClient();
      const { data: target } = await supabase.from("employees").select("manager_id").eq("id", employeeId).maybeSingle();
      const allowed = canManagerAccessTeamMember(permissions, viewerEmployee?.id ?? null, target?.manager_id ?? null);
      if (!allowed) return { error: "You can only create reviews for your own direct reports." };
    }

    const reviewPeriod = String(formData.get("reviewPeriod") ?? "").trim();
    if (!reviewPeriod) return { error: "Review period is required." };
    const overallRating = String(formData.get("overallRating") ?? "").trim() || undefined;
    const managerFeedback = String(formData.get("managerFeedback") ?? "").trim() || undefined;
    const publish = formData.get("publish") === "on";

    const result = await createPerformanceReview({
      employeeId, reviewerEmail: permissions.email, reviewerName: permissions.name ?? null,
      reviewPeriod, overallRating, managerFeedback, publish,
    });
    if (result.error) return result;

    await logAudit({
      actorEmail: permissions.email, actorName: permissions.name, action: "performance_review_created",
      targetType: "performance_review", targetId: employeeId, targetLabel: reviewPeriod,
      metadata: { published: publish },
    });

    revalidatePath(`/people/${employeeId}`);
    revalidatePath("/profile");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save this review." };
  }
}

/** Career Development is HR/Super Admin editable only — Managers see it (via team access) but don't edit it, matching the brief's silence on Manager edit rights here. */
export async function updateCareerDevelopmentAction(employeeId: string, formData: FormData): Promise<ActionResult> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.isAdmin && permissions.role !== "HR/Admin") {
      return { error: "Only HR or a Super Admin can update career development." };
    }
    const result = await updateCareerDevelopment(employeeId, {
      trainingGoals: String(formData.get("trainingGoals") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      developmentPlans: String(formData.get("developmentPlans") ?? "").trim(),
      completedProgrammes: String(formData.get("completedProgrammes") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      futureCareerPath: String(formData.get("futureCareerPath") ?? "").trim(),
      promotionRecommendations: String(formData.get("promotionRecommendations") ?? "").trim(),
    });
    if (result.error) return result;
    revalidatePath(`/people/${employeeId}`);
    revalidatePath("/profile");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save career development." };
  }
}
