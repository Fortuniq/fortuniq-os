import { getInvoices, getExpenses, getSuppliers } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { FinanceView } from "./finance-view";

export default async function FinancePage() {
  await requireModuleAccess("finance");
  const [invoices, expenses, suppliers] = await Promise.all([
    getInvoices(),
    getExpenses(),
    getSuppliers(),
  ]);
  return <FinanceView invoices={invoices} expenses={expenses} suppliers={suppliers} />;
}
