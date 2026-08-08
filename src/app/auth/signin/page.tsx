import Image from "next/image";
import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="w-full max-w-sm px-6">
        <div className="flex flex-col items-center mb-10">
          <Image src="/brand/logo-icon-white.png" alt="FortunIQ" width={44} height={41} />
          <p className="font-display font-black text-white text-lg mt-4">
            FortunIQ <span className="text-orange">OS</span>
          </p>
          <p className="text-[11px] text-light-grey tracking-wide mt-1">INTERNAL PLATFORM</p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-white text-navy font-semibold text-sm py-3 rounded-lg hover:bg-surface transition-colors"
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </button>
        </form>

        <p className="text-center text-xs text-light-grey mt-6">
          Access is limited to FortunIQ Fuels Microsoft 365 accounts.
        </p>
      </div>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
