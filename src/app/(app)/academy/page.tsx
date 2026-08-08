import { getCourses, getLearningPaths } from "@/lib/data";
import { AcademyView } from "./academy-view";

export default async function AcademyPage() {
  const [courses, learningPaths] = await Promise.all([getCourses(), getLearningPaths()]);
  return <AcademyView courses={courses} learningPaths={learningPaths} />;
}
