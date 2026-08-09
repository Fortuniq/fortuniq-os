import Image from "next/image";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { signOutAction } from "@/app/actions";

export default async function PendingApprovalPage() {
  const permissions = await getCurrentUserPermissions();

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="w-full max-w-sm px-6 text-center">
        <div className="flex flex-col items-center mb-8">
          <Image src="/brand/logo-icon-white.png" alt="FortunIQ" width={44} height={41} />
          <p className="font-display font-black text-white text-lg mt-4">
            FortunIQ <span className="text-orange">OS</span>
          </p>
        </div>

        <h1 className="text-white font-display font-bold text-xl mb-2">Almost there</h1>
        <p className="text-light-grey text-sm leading-relaxed mb-1">
          You&apos;re signed in as <span className="text-white">{permissions.name}</span>, but an
          administrator hasn&apos;t set up your access yet.
        </p>
        <p className="text-light-grey text-sm leading-relaxed mb-8">
          Ask your FortunIQ OS administrator to add <span className="text-white">{permissions.email}</span> in
          Settings → Team Management.
        </p>

        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-light-grey hover:text-white transition-colors underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
