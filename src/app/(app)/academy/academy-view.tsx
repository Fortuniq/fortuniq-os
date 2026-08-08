"use client";

import { PlayCircle, Award, Route, ClipboardCheck, BarChart2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";

type Course = {
  id: string | number;
  title: string;
  category: string;
  modules: number;
  duration: string;
  enrolled: number;
  completion: number;
};
type LearningPath = { id: string | number; title: string; courses: number; forRole: string };

export function AcademyView({ courses, learningPaths }: { courses: Course[]; learningPaths: LearningPath[] }) {
  const avgCompletion = Math.round(courses.reduce((s, c) => s + c.completion, 0) / courses.length);

  return (
    <div>
      <PageHeader title="FortunIQ Academy" description="Training, onboarding and certification for every role." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Courses" value={String(courses.length)} icon={PlayCircle} />
        <StatCard label="Learning Paths" value={String(learningPaths.length)} icon={Route} />
        <StatCard label="Avg. Completion" value={`${avgCompletion}%`} icon={BarChart2} />
        <StatCard label="Certificates Issued" value="24" sub="This year" icon={Award} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Courses</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center shrink-0">
                  <PlayCircle className="w-5 h-5 text-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">{c.title}</p>
                  <p className="text-xs text-light-grey">
                    {c.category} · {c.modules} modules · {c.duration} · {c.enrolled} enrolled
                  </p>
                </div>
                <div className="w-28 shrink-0">
                  <div className="flex justify-between text-[10px] text-light-grey mb-1">
                    <span>{c.completion}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-orange rounded-full" style={{ width: `${c.completion}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Learning Paths</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {learningPaths.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-1.5">
                  <Route className="w-4 h-4 text-orange shrink-0" />
                  <div>
                    <p className="text-sm text-navy font-medium">{p.title}</p>
                    <p className="text-xs text-light-grey">{p.courses} courses · {p.forRole}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manager Dashboard</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-navy">
                <ClipboardCheck className="w-4 h-4 text-orange" /> 3 assessments awaiting review
              </div>
              <div className="flex items-center gap-2 text-sm text-navy">
                <Award className="w-4 h-4 text-orange" /> 2 certificates ready to issue
              </div>
              <p className="text-xs text-light-grey pt-1">
                Managers can track department-wide training progress and assign courses directly from here.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
