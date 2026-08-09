import { getCourses, getLearningPaths } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { AcademyView } from "./academy-view";

export default async function AcademyPage() {
  await requireModuleAccess("academy");
  const [courses, learningPaths] = await Promise.all([getCourses(), getLearningPaths()]);
  return <AcademyView courses={courses} learningPaths={learningPaths} />;
}
