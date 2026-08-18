import { createServiceClient } from "@/lib/supabase/service";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export type PerformanceReview = {
  id: string;
  employeeId: string;
  reviewerEmail: string;
  reviewerName: string | null;
  reviewPeriod: string;
  overallRating: string | null;
  kpis: { title: string; status: string }[];
  objectives: { title: string; status: string }[];
  managerFeedback: string | null;
  status: "Draft" | "Published";
  createdAt: string;
};

function mapRow(row: Record<string, unknown>): PerformanceReview {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    reviewerEmail: row.reviewer_email as string,
    reviewerName: (row.reviewer_name as string) ?? null,
    reviewPeriod: row.review_period as string,
    overallRating: (row.overall_rating as string) ?? null,
    kpis: (row.kpis as { title: string; status: string }[]) ?? [],
    objectives: (row.objectives as { title: string; status: string }[]) ?? [],
    managerFeedback: (row.manager_feedback as string) ?? null,
    status: row.status as "Draft" | "Published",
    createdAt: row.created_at as string,
  };
}

/** Only Published reviews — a Draft in progress is never shown to the employee. See docs/HCM_PHASE3.md. */
export async function getMyPublishedReviews(employeeId: string): Promise<PerformanceReview[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("performance_reviews").select("*").eq("employee_id", employeeId).eq("status", "Published").order("created_at", { ascending: false });
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

/** Every review (Draft + Published) for the HR/Manager-facing Employee Profile screen. */
export async function getAllReviewsForEmployee(employeeId: string): Promise<PerformanceReview[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("performance_reviews").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

export async function createPerformanceReview(params: {
  employeeId: string; reviewerEmail: string; reviewerName: string | null; reviewPeriod: string;
  overallRating?: string; kpis?: { title: string; status: string }[]; objectives?: { title: string; status: string }[];
  managerFeedback?: string; publish: boolean;
}): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: "Performance management isn't available until a database is connected." };
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("performance_reviews").insert({
      employee_id: params.employeeId,
      reviewer_email: params.reviewerEmail,
      reviewer_name: params.reviewerName,
      review_period: params.reviewPeriod,
      overall_rating: params.overallRating ?? null,
      kpis: params.kpis ?? [],
      objectives: params.objectives ?? [],
      manager_feedback: params.managerFeedback ?? null,
      status: params.publish ? "Published" : "Draft",
    });
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save this review." };
  }
}

export async function updateCareerDevelopment(employeeId: string, careerDevelopment: {
  trainingGoals: string[]; developmentPlans: string; completedProgrammes: string[]; futureCareerPath: string; promotionRecommendations: string;
}): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: "Not available until a database is connected." };
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("employees").update({
      career_development: careerDevelopment, updated_at: new Date().toISOString(),
    }).eq("id", employeeId);
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save career development." };
  }
}
