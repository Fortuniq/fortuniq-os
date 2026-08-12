"use client";

import Link from "next/link";
import { GraduationCap, ChevronRight, Settings2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import type { School } from "@/lib/data";

export function AcademyView({ schools, isAdmin }: { schools: School[]; isAdmin: boolean }) {
  const totalCourses = schools.reduce((s, sc) => s + sc.courseCount, 0);
  const totalCompleted = schools.reduce((s, sc) => s + sc.completedCount, 0);

  return (
    <div>
      <PageHeader
        title="FortunIQ Academy"
        description="Learn at your own pace — courses, video lessons, and assessments across five schools."
        action={isAdmin ? (
          <Link href="/academy/admin" className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg hover:bg-orange transition-colors">
            <Settings2 className="w-3.5 h-3.5" /> Manage Content
          </Link>
        ) : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Schools" value={String(schools.length)} icon={GraduationCap} />
        <StatCard label="Total Courses" value={String(totalCourses)} icon={GraduationCap} />
        <StatCard label="Your Completions" value={String(totalCompleted)} sub={`of ${totalCourses} available`} icon={GraduationCap} />
      </div>

      {schools.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-sm text-grey">
              No schools set up yet — run <code className="bg-surface px-1.5 py-0.5 rounded text-xs">migration_v9_academy_schools.sql</code> to get started.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((school) => (
            <Link key={school.id} href={`/academy/${school.id}`}>
              <Card className="p-5 hover:border-orange transition-colors cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center text-2xl shrink-0">
                    {school.icon}
                  </div>
                  <ChevronRight className="w-5 h-5 text-light-grey" />
                </div>
                <h3 className="font-display font-bold text-navy text-base mb-1">{school.name}</h3>
                <p className="text-xs text-grey flex-1">{school.description}</p>
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-light-grey">{school.courseCount} courses</span>
                    <span className="font-semibold text-navy">{school.completedCount}/{school.courseCount} complete</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-orange rounded-full transition-all"
                      style={{ width: `${school.courseCount ? (school.completedCount / school.courseCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
