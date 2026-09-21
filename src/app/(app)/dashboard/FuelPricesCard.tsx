import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";

/**
 * Public operational reference data (not confidential — see data.ts),
 * shown to everyone WITHOUT broad organisation visibility as a
 * customizable personal widget. Someone with broad visibility
 * (Super Admin/Management) instead sees it paired with the Sales Trend
 * chart in the Organisation Overview section — that variant is NOT
 * this component; it's still hand-coded in dashboard-view.tsx since
 * it's org-wide reporting, not a personal-productivity widget (Project
 * ORION Phase 1 deliberately scopes customization to personal widgets
 * only — see dashboard-widgets.ts).
 */
export function FuelPricesCard({ fuelPrices }: { fuelPrices: { product: string; price: number; change: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Fuel Prices</CardTitle>
        <span className="text-xs text-light-grey">Gauteng / Inland</span>
      </CardHeader>
      <CardBody className="space-y-3">
        {fuelPrices.map((f) => (
          <div key={f.product} className="flex items-center justify-between">
            <span className="text-sm text-navy">{f.product}</span>
            <div className="text-right">
              <p className="text-sm font-bold text-navy">R{f.price.toFixed(2)}</p>
              <p className="text-xs text-emerald-600">{f.change.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
