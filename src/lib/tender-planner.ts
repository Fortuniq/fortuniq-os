import { createServiceClient } from "@/lib/supabase/service";
import {
  isPlannerConfigured, ensureTenderPlannerBuckets, createPlannerTask,
  movePlannerTaskToBucket, completePlannerTask, type TenderWorkflowStage,
} from "@/lib/graph";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Syncs one FortunIQ OS task (already inserted, module_key='tenders')
 * into Microsoft Planner — creates the matching Planner task in the
 * bucket for the tender's current stage, and stores the returned
 * planner_task_id back on the row. Best-effort and entirely one-way
 * (FortunIQ OS -> Planner): a Planner failure never blocks or undoes
 * the FortunIQ OS task that already exists. See docs/TENDER_PLANNER.md,
 * "Sync direction."
 */
export async function syncNewTenderTaskToPlanner(params: {
  taskId: string;
  accessToken: string;
  title: string;
  stage: TenderWorkflowStage;
  dueDate?: string | null;
}): Promise<void> {
  if (!isPlannerConfigured || !supabaseConfigured) return;
  try {
    const buckets = await ensureTenderPlannerBuckets(params.accessToken);
    const bucketId = buckets[params.stage];
    if (!bucketId) return;
    const plannerTaskId = await createPlannerTask(
      params.accessToken, bucketId, params.title,
      params.dueDate ? `${params.dueDate}T00:00:00Z` : undefined
    );
    const supabase = createServiceClient();
    await supabase.from("tasks").update({ planner_task_id: plannerTaskId, planner_bucket_id: bucketId }).eq("id", params.taskId);
  } catch (err) {
    console.error("syncNewTenderTaskToPlanner failed (FortunIQ OS task is still saved):", err);
  }
}

/**
 * When a tender's workflow stage changes, moves every one of its
 * already-Planner-synced tasks into the matching bucket — so the
 * Planner board visibly reflects the same stage FortunIQ OS shows.
 * Best-effort: a Planner failure never blocks the actual stage change
 * in FortunIQ OS, which remains the system of record.
 */
export async function syncTenderStageToPlanner(params: {
  tenderId: string;
  accessToken: string;
  newStage: TenderWorkflowStage;
}): Promise<void> {
  if (!isPlannerConfigured || !supabaseConfigured) return;
  try {
    const supabase = createServiceClient();
    const { data: tasksToMove } = await supabase
      .from("tasks")
      .select("id, planner_task_id")
      .eq("module_key", "tenders")
      .eq("record_id", params.tenderId)
      .not("planner_task_id", "is", null);
    if (!tasksToMove || tasksToMove.length === 0) return;

    const buckets = await ensureTenderPlannerBuckets(params.accessToken);
    const bucketId = buckets[params.newStage];
    if (!bucketId) return;

    for (const task of tasksToMove) {
      try {
        await movePlannerTaskToBucket(params.accessToken, task.planner_task_id as string, bucketId);
        await supabase.from("tasks").update({ planner_bucket_id: bucketId }).eq("id", task.id);
      } catch (err) {
        console.error(`syncTenderStageToPlanner: failed to move task ${task.id}:`, err);
      }
    }
  } catch (err) {
    console.error("syncTenderStageToPlanner failed:", err);
  }
}

/** Marks a Planner task complete when its matching FortunIQ OS task is completed. Best-effort, one-way. */
export async function syncTaskCompletionToPlanner(taskId: string, accessToken: string): Promise<void> {
  if (!isPlannerConfigured || !supabaseConfigured) return;
  try {
    const supabase = createServiceClient();
    const { data: task } = await supabase.from("tasks").select("planner_task_id").eq("id", taskId).maybeSingle();
    if (!task?.planner_task_id) return;
    await completePlannerTask(accessToken, task.planner_task_id as string);
  } catch (err) {
    console.error("syncTaskCompletionToPlanner failed:", err);
  }
}
