import { coreFocusVisibleRing, corePrimaryButton } from "@/lib/core-editing-palette";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mb-6">
        C
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">You're offline</h1>
      <p className="text-slate-400 text-sm max-w-xs mb-8">
        No internet connection. Check your connection, then try again.
      </p>
      <a
        href="/dashboard/mobile"
        className={`text-sm font-medium px-6 py-3 rounded-xl transition-colors ${corePrimaryButton} hover:bg-[#e0f9e3] ${coreFocusVisibleRing}`}
      >
        Back to Hub
      </a>
    </div>
  );
}
