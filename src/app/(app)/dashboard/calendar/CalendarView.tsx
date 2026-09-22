"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, RefreshCw, Plus, X, Check } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildMonthGrid, groupEventsByDate, MONTH_LABELS, WEEKDAY_LABELS } from "@/lib/calendar-core";
import { createCalendarEventAction, deleteCalendarEventAction, syncOutlookCalendarAction } from "../calendar-actions";
import type { CalendarEvent } from "@/lib/calendar";
import type { SpecialDay } from "@/lib/holidays-core";

export function CalendarView({
  events, specialDays, year, monthIndex0, todayISO,
}: {
  events: CalendarEvent[];
  specialDays: SpecialDay[];
  year: number;
  monthIndex0: number;
  todayISO: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [adding, setAdding] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grid = buildMonthGrid(year, monthIndex0, todayISO);
  const byDate = groupEventsByDate(events);
  const specialDaysByDate = groupEventsByDate(specialDays.map((d) => ({ ...d, eventDate: d.date })));
  const selectedEvents = (byDate.get(selectedDate) ?? []).slice().sort((a, b) => (a.eventTime ?? "").localeCompare(b.eventTime ?? ""));
  const selectedSpecialDays = specialDaysByDate.get(selectedDate) ?? [];

  function handleSync() {
    setError(null);
    setSyncMessage(null);
    startTransition(async () => {
      const result = await syncOutlookCalendarAction();
      if (result.error) setError(result.error);
      else { setSyncMessage(`Synced — ${result.pushed ?? 0} pushed, ${result.pulled ?? 0} pulled.`); router.refresh(); }
    });
  }

  function handleAdd(formData: FormData) {
    setError(null);
    const title = String(formData.get("title") ?? "").trim();
    const eventTime = String(formData.get("eventTime") ?? "") || undefined;
    startTransition(async () => {
      const result = await createCalendarEventAction({ title, eventDate: selectedDate, eventTime, eventType: "General" });
      if (result.error) setError(result.error);
      else { setAdding(false); router.refresh(); }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteCalendarEventAction(id);
      router.refresh();
    });
  }

  const prevHref = monthIndex0 === 0 ? `?y=${year - 1}&m=12` : `?y=${year}&m=${monthIndex0}`;
  const nextHref = monthIndex0 === 11 ? `?y=${year + 1}&m=1` : `?y=${year}&m=${monthIndex0 + 2}`;

  return (
    <div>
      <PageHeader title="My Calendar" description="Your personal FortunIQ + Outlook calendar, in one place." />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link href={prevHref} className="p-1.5 rounded-lg border border-border hover:border-orange transition-colors"><ChevronLeft className="w-4 h-4" /></Link>
          <p className="font-display font-bold text-navy w-40 text-center">{MONTH_LABELS[monthIndex0]} {year}</p>
          <Link href={nextHref} className="p-1.5 rounded-lg border border-border hover:border-orange transition-colors"><ChevronRight className="w-4 h-4" /></Link>
        </div>
        <button onClick={handleSync} disabled={isPending} className="flex items-center gap-1.5 text-xs font-semibold text-navy border border-border px-3 py-1.5 rounded-lg hover:border-orange transition-colors disabled:opacity-50">
          <RefreshCw className="w-3.5 h-3.5" /> Sync with Outlook
        </button>
      </div>
      {syncMessage && <p className="text-xs text-green-700 mb-2">{syncMessage}</p>}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((w) => <p key={w} className="text-xs font-semibold text-light-grey text-center py-1">{w}</p>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const dayEvents = byDate.get(cell.date) ?? [];
          const daySpecialDays = specialDaysByDate.get(cell.date) ?? [];
          const isPublicHoliday = daySpecialDays.some((d) => d.kind === "public-holiday");
          return (
            <button
              key={cell.date}
              onClick={() => { setSelectedDate(cell.date); setAdding(false); }}
              className={`aspect-square sm:aspect-[4/3] rounded-lg border p-1.5 text-left transition-colors ${
                selectedDate === cell.date ? "border-orange bg-orange/5" : isPublicHoliday ? "border-orange/30 bg-orange/5" : "border-border hover:border-orange/50"
              } ${!cell.inCurrentMonth ? "opacity-40" : ""}`}
            >
              <p className={`text-xs font-semibold ${cell.isToday ? "text-orange" : "text-navy"}`}>{Number(cell.date.slice(8, 10))}</p>
              {daySpecialDays.map((d) => (
                <p key={d.name} className="text-[10px] text-orange truncate">{d.name}</p>
              ))}
              {dayEvents.length > 0 && (
                <p className="text-[10px] text-light-grey mt-0.5 truncate">{dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}</p>
              )}
            </button>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardBody className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-navy">{selectedDate}</p>
            {!adding && (
              <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-orange transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add event
              </button>
            )}
          </div>

          {adding && (
            <form action={handleAdd} className="border border-border rounded-lg p-2.5 space-y-2 bg-surface">
              <input name="title" placeholder="Event title" required className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
              <input name="eventTime" type="time" className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
              <div className="flex gap-2">
                <button type="submit" disabled={isPending} className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-2.5 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" /> Add
                </button>
                <button type="button" onClick={() => setAdding(false)} className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-navy transition-colors">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </form>
          )}

          {selectedSpecialDays.map((d) => (
            <div key={d.name} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
              <p className="text-xs font-semibold text-orange w-14 shrink-0">All day</p>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-orange">{d.name}</p>
                <p className="text-xs text-light-grey">{d.kind === "public-holiday" ? "South African Public Holiday" : "International Day"}</p>
              </div>
            </div>
          ))}

          {selectedEvents.length === 0 && selectedSpecialDays.length === 0 && !adding && <p className="text-sm text-light-grey py-1">Nothing scheduled.</p>}
          {selectedEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
              <p className="text-xs font-semibold text-navy w-14 shrink-0">{e.eventTime ?? "All day"}</p>
              <div className="flex-1 min-w-0">
                {e.recordUrl ? (
                  <a href={e.recordUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-navy hover:text-orange transition-colors">{e.title}</a>
                ) : (
                  <p className="text-sm text-navy">{e.title}</p>
                )}
                <p className="text-xs text-light-grey">{e.eventType}{e.source === "outlook" ? " · Outlook" : ""}</p>
              </div>
              {e.source === "fortuniq" && (
                <button onClick={() => handleDelete(e.id)} className="text-grey hover:text-red-600 transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
