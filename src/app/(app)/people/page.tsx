import { getEmployees } from "@/lib/data";
import { PeopleView } from "./people-view";

export default async function PeoplePage() {
  const employees = await getEmployees();
  return <PeopleView employees={employees} />;
}
