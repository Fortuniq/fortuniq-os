import { ShieldAlert } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        <ShieldAlert className="w-7 h-7 text-amber-600" />
      </div>
      <h1 className="font-display text-xl font-bold text-navy mb-2">You don&apos;t have access to this page</h1>
      <p className="text-sm text-grey max-w-sm">
        If you think this is a mistake, ask a FortunIQ OS administrator to update your access in
        Settings → Team Management.
      </p>
    </div>
  );
}
