import { notFound } from "next/navigation";
import { getSchoolWithCourses } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { SchoolView } from "./school-view";

export default async function SchoolPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const permissions = await requireModuleAccess("academy");
  const { schoolId } = await params;
  const { school, courses } = await getSchoolWithCourses(schoolId, permissions.email);
  if (!school) notFound();
  return <SchoolView school={school} courses={courses} />;
}
