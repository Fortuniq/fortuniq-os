import { getFuelOrders, getFleet } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { OperationsView } from "./operations-view";

export default async function OperationsPage() {
  await requireModuleAccess("operations");
  const [fuelOrders, fleet] = await Promise.all([getFuelOrders(), getFleet()]);
  return <OperationsView fuelOrders={fuelOrders} fleet={fleet} />;
}
