import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useUserProfile } from "@/lib/user-profile";

function firstWord(value: unknown): string {
  return typeof value === "string" ? (value.trim().split(/\s+/)[0] ?? "") : "";
}

function greetingName(user: User, profile: ReturnType<typeof useUserProfile>["data"]): string {
  return (
    firstWord(profile?.nickname) ||
    firstWord(profile?.firstName) ||
    firstWord(user.user_metadata?.first_name) ||
    firstWord(user.user_metadata?.firstName) ||
    firstWord(user.user_metadata?.full_name) ||
    firstWord(user.email?.split("@")[0]) ||
    "there"
  );
}

export function AppStartupWelcome({ ready, user }: { ready: boolean; user: User }) {
  const native = Capacitor.isNativePlatform();
  const profile = useUserProfile();
  const name = useMemo(() => greetingName(user, profile.data), [profile.data, user]);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(native);

  useEffect(() => {
    if (!native) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("canvaspro:launch-ui-ready"));
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [native]);

  useEffect(() => {
    if (!native || !ready || !visible) return;
    setLeaving(true);
    const timer = window.setTimeout(() => setVisible(false), 520);
    return () => window.clearTimeout(timer);
  }, [native, ready, visible]);

  if (!visible) return null;

  return (
    <section
      className={`fixed inset-0 z-[100] overflow-y-auto bg-[#050506] text-white transition duration-500 ease-out lg:overflow-hidden ${
        leaving ? "pointer-events-none scale-[1.015] opacity-0" : "scale-100 opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Preparing CanvasPro"
    >
      <div className="absolute -left-24 top-[-15%] h-[28rem] w-[28rem] rounded-full bg-blue-500/10 blur-[110px]" />
      <div className="absolute -bottom-40 right-[-10%] h-[34rem] w-[34rem] rounded-full bg-violet-500/10 blur-[130px]" />

      <div className="relative grid min-h-full grid-cols-1 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="flex min-h-[52dvh] flex-col justify-between border-white/10 px-7 pb-8 pt-[max(2rem,env(safe-area-inset-top))] sm:px-12 sm:pb-12 lg:min-h-full lg:border-r lg:px-[clamp(3rem,7vw,7.5rem)] lg:py-[clamp(3rem,9vh,7rem)]">
          <div className="flex items-center gap-3 text-sm tracking-wide text-white/55">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white text-sm font-semibold text-black shadow-[0_14px_40px_rgba(255,255,255,0.12)]">
              CP
            </span>
            <span>CanvasPro</span>
          </div>

          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-700">
            <p className="mb-4 text-xs uppercase tracking-[0.24em] text-white/40">Your workspace</p>
            <h1 className="text-balance text-[clamp(2.6rem,7vw,6.8rem)] font-medium leading-[0.94] tracking-[-0.065em]">
              Hello, <span className="text-white/60">{name},</span>
              <span className="mt-2 block">welcome to CanvasPro</span>
            </h1>
          </div>

          <p className="hidden max-w-md text-sm leading-relaxed text-white/35 sm:block">
            Your courses, priorities, and progress—ready where you left them.
          </p>
        </div>

        <div className="flex min-h-[48dvh] flex-col items-center justify-center px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-12 lg:min-h-full lg:py-16">
          <div className="relative grid h-32 w-32 place-items-center sm:h-52 sm:w-52">
            <div className="absolute inset-0 rounded-full border border-white/[0.07]" />
            <div className="absolute inset-3 animate-spin rounded-full border border-transparent border-t-white/70 [animation-duration:1.8s]" />
            <div className="absolute inset-7 animate-spin rounded-full border border-transparent border-b-white/25 [animation-direction:reverse] [animation-duration:2.6s] sm:inset-9" />
            <div className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,0.8)]" />
            <div className="grid h-16 w-16 place-items-center rounded-[1.5rem] border border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl sm:h-20 sm:w-20 sm:rounded-[1.8rem]">
              <div className="flex items-end gap-1.5" aria-hidden="true">
                <span className="h-4 w-1 rounded-full bg-white/35 motion-safe:animate-pulse" />
                <span className="h-7 w-1 rounded-full bg-white/75 motion-safe:animate-pulse [animation-delay:150ms]" />
                <span className="h-5 w-1 rounded-full bg-white/45 motion-safe:animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          </div>

          <div className="mt-6 max-w-sm text-center animate-in fade-in duration-700 delay-150 sm:mt-9">
            <p className="text-lg font-medium tracking-[-0.025em] sm:text-xl">
              We’re getting everything put together.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              Bringing your latest Canvas data into focus.
            </p>
            <div className="mt-6 flex justify-center gap-2" aria-hidden="true">
              <span className="h-1.5 w-8 rounded-full bg-white/80" />
              <span className="h-1.5 w-3 rounded-full bg-white/25 motion-safe:animate-pulse" />
              <span className="h-1.5 w-3 rounded-full bg-white/15 motion-safe:animate-pulse [animation-delay:250ms]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
