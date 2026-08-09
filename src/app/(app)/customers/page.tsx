import { getCustomers } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { CustomersView } from "./customers-view";

export default async function CustomersPage() {
  await requireModuleAccess("customers");
  const customers = await getCustomers();
  return <CustomersView customers={customers} />;
}
