"use client";

import Link from "next/link";
import { ArrowLeft, PlayCircle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { School, CourseSummary } from "@/lib/data";

const STATUS_TONE = {
  "Not Started": "neutral",
  "In Progress": "warning",
  "Completed": "success",
} as const;

export function SchoolView({ school, courses }: { school: School; courses: CourseSummary[] }) {
  return (
    <div>
      <Link href="/academy" className="flex items-center gap-1.5 text-sm text-grey hover:text-navy transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Academy
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl bg-navy flex items-center justify-center text-3xl shrink-0">{school.icon}</div>
        <div>
          <h1 className="font-display text-2xl font-black text-navy">{school.name}</h1>
          <p className="text-sm text-grey">{school.description}</p>
        </div>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-sm text-grey">No courses in this school yet.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Link key={course.id} href={`/academy/course/${course.id}`}>
              <Card className="p-4 hover:border-orange transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center shrink-0">
                    {course.status === "Completed" ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <PlayCircle className="w-5 h-5 text-orange" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-navy text-sm">{course.title}</p>
                    <p className="text-xs text-grey truncate">{course.description}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-xs text-light-grey shrink-0">
                    <Clock className="w-3.5 h-3.5" /> {course.duration ?? "—"} · {course.lessonCount} lessons
                  </div>
                  <Badge tone={STATUS_TONE[course.status]}>{course.status}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
