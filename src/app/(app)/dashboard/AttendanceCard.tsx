"use client";

import { useState, useTransition } from "react";
import { Clock, LogIn, LogOut } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { clockInAction, clockOutAction } from "../attendance/attendance-actions";
import { formatDuration } from "@/lib/attendance-core";

type AttendanceToday = {
  clockInAt: string | null;
  clockOutAt: string | null;
  totalMinutes: number | null;
  status: "Clocked In" | "Clocked Out" | "Missing Clock-Out";
  late: boolean;
} | null;

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
}

function liveMinutes(clockInAt: string) {
  return Math.max(0, Math.round((Date.now() - new Date(clockInAt).getTime()) / 60000));
}

export function AttendanceCard({ initial }: { initial: AttendanceToday }) {
  const [attendance, setAttendance] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const status = attendance?.status ?? null;

  function handleClockIn() {
    setError(null);
    startTransition(async () => {
      const result = await clockInAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setAttendance({ clockInAt: new Date().toISOString(), clockOutAt: null, totalMinutes: null, status: "Clocked In", late: false });
    });
  }

  function handleClockOut() {
    setError(null);
    startTransition(async () => {
      const result = await clockOutAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setAttendance((prev) =>
        prev ? { ...prev, clockOutAt: new Date().toISOString(), status: "Clocked Out" } : prev
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-orange" /> Today&apos;s Attendance
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        {status ? (
          <div className="space-y-2 mb-4">
            <p className="text-sm text-navy">
              <span className="font-semibold">Status:</span> {status}
              {attendance?.late && <span className="text-amber-600 ml-1">(Late)</span>}
            </p>
            <p className="text-sm text-grey">
              <span className="font-semibold text-navy">Clocked in:</span> {fmtTime(attendance?.clockInAt ?? null)}
            </p>
            {status === "Clocked Out" ? (
              <p className="text-sm text-grey">
                <span className="font-semibold text-navy">Clocked out:</span> {fmtTime(attendance?.clockOutAt ?? null)}
                {" · "}
                <span className="font-semibold text-navy">Total:</span>{" "}
                {formatDuration(attendance?.totalMinutes ?? null)}
              </p>
            ) : (
              attendance?.clockInAt && (
                <p className="text-sm text-grey">
                  <span className="font-semibold text-navy">Time worked:</span>{" "}
                  {formatDuration(liveMinutes(attendance.clockInAt))}
                </p>
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-light-grey mb-4">You haven&apos;t clocked in yet today.</p>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        {status === "Clocked Out" ? (
          <p className="text-xs text-light-grey">Attendance recorded for today.</p>
        ) : status === "Clocked In" ? (
          <button
            onClick={handleClockOut}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" /> Clock Out
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
          >
            <LogIn className="w-3.5 h-3.5" /> Clock In
          </button>
        )}
      </CardBody>
    </Card>
  );
}
