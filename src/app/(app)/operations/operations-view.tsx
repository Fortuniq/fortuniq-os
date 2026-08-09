"use client";

import { Truck, Fuel, MapPin, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";

type FuelOrder = { id: string | number; customer: string; product: string; volume: number; status: string; eta: string };
type Vehicle = { id: string | number; vehicle: string; capacity: string; driver: string; status: string };

const orderColumns: Column<FuelOrder>[] = [
  { key: "id", header: "Order" },
  { key: "customer", header: "Customer" },
  { key: "product", header: "Product" },
  { key: "volume", header: "Volume", align: "right", render: (r) => `${r.volume.toLocaleString()} L` },
  { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
  { key: "eta", header: "ETA" },
];

const fleetColumns: Column<Vehicle>[] = [
  { key: "id", header: "Unit" },
  { key: "vehicle", header: "Vehicle" },
  { key: "capacity", header: "Capacity" },
  { key: "driver", header: "Driver" },
  { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
];

export function OperationsView({ fuelOrders, fleet }: { fuelOrders: FuelOrder[]; fleet: Vehicle[] }) {
  const inTransit = fuelOrders.filter((o) => o.status === "In Transit").length;
  const available = fleet.filter((f) => f.status === "Available").length;
  const totalVolume = fuelOrders.reduce((s, o) => s + o.volume, 0);

  return (
    <div>
      <PageHeader title="Operations" description="Fuel orders, deliveries, fleet, loading and proof of delivery." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Orders" value={String(fuelOrders.length)} icon={Fuel} />
        <StatCard label="In Transit" value={String(inTransit)} icon={Truck} />
        <StatCard label="Fleet Available" value={String(available)} sub={`of ${fleet.length} vehicles`} icon={MapPin} />
        <StatCard label="Volume This Week" value={`${(totalVolume / 1000).toFixed(0)}K L`} icon={CheckCircle2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Fuel Orders</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <DataTable columns={orderColumns} data={fuelOrders} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fleet Status</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <DataTable columns={fleetColumns} data={fleet} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
