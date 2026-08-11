import { notFound } from "next/navigation";
import { getCourseDetail } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { CoursePlayerView } from "./course-player-view";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const permissions = await requireModuleAccess("academy");
  const { courseId } = await params;
  const course = await getCourseDetail(courseId, permissions.email ?? "");
  if (!course) notFound();
  return <CoursePlayerView course={course} />;
}
