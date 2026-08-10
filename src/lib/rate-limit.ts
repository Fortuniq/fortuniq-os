import { createServiceClient } from "@/lib/supabase/service";

/**
 * A simple, real rate limiter backed by Supabase — no extra service
 * (like Redis) required, since it reuses infrastructure you already have.
 *
 * Counts how many times a person has hit a given "bucket" (e.g. "ai-chat")
 * in the last `windowSeconds`, and returns whether they're still under
 * `maxRequests`. Fails open (allows the request) if the check itself
 * errors — a rate limiter that accidentally locks everyone out during a
 * database hiccup would be worse than one that occasionally under-limits.
 */
export async function checkRateLimit(
  actorEmail: string,
  bucket: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const supabase = createServiceClient();
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { count } = await supabase
      .from("rate_limit_events")
      .select("*", { count: "exact", head: true })
      .eq("actor_email", actorEmail)
      .eq("bucket", bucket)
      .gte("created_at", windowStart);

    const used = count ?? 0;
    if (used >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    await supabase.from("rate_limit_events").insert({ actor_email: actorEmail, bucket });
    return { allowed: true, remaining: maxRequests - used - 1 };
  } catch (err) {
    console.error("Rate limit check failed, allowing request through:", err);
    return { allowed: true, remaining: -1 };
  }
}
