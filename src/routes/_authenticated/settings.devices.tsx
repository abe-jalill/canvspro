import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppWindow, Laptop, LogOut, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, ErrorState } from "@/components/glass-card";
import { SettingsPage } from "@/components/settings-page";
import { SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { describeDevice, deviceLine, type DeviceDescription } from "@/lib/devices";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserScope } from "@/lib/user-scope";

export const Route = createFileRoute("/_authenticated/settings/devices")({
  head: () => ({
    meta: [
      { title: "Signed-in Devices — CoursePro" },
      {
        name: "description",
        content:
          "See every device signed in to your CoursePro account and sign out of any of them.",
      },
      { property: "og:title", content: "Signed-in Devices — CoursePro" },
      {
        property: "og:description",
        content:
          "See every device signed in to your CoursePro account and sign out of any of them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevicesPage,
});

interface SignedInDevice {
  id: string;
  created_at: string;
  last_active_at: string;
  user_agent: string | null;
  is_current: boolean;
}

const ICONS: Record<DeviceDescription["kind"], typeof Laptop> = {
  phone: Smartphone,
  tablet: Tablet,
  computer: Laptop,
  other: AppWindow,
};

const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition hover:bg-foreground/5 disabled:opacity-50";

function DevicesPage() {
  const scope = useUserScope();
  const queryClient = useQueryClient();
  const signOut = useSignOut();
  const [confirmAll, setConfirmAll] = useState(false);
  const key = ["signed-in-devices", scope] as const;

  const devices = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_my_sessions");
      if (error) throw new Error("Couldn't load your devices. Try again in a moment.");
      return (data ?? []) as SignedInDevice[];
    },
    refetchOnWindowFocus: true,
  });

  const endOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_my_session", { target: id });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Signed out of that device"),
    onError: () => toast.error("Couldn't sign out of that device. Try again."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const endOthers = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("revoke_my_other_sessions");
      if (error) throw error;
      return data ?? 0;
    },
    onError: () => toast.error("Couldn't sign out of your other devices. Try again."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const list = devices.data ?? [];
  const others = list.filter((device) => !device.is_current);

  async function signOutEverywhere() {
    setConfirmAll(false);
    try {
      await endOthers.mutateAsync();
    } catch {
      return;
    }
    await signOut("Signed out on every device.");
  }

  return (
    <SettingsPage
      title="Signed-in devices"
      description="Everywhere your account is signed in. Sign out of any of them from here."
    >
      <GlassCard
        title="Your devices"
        subtitle="A device you sign out of goes back to the sign-in page and stops getting notifications."
      >
        {devices.isLoading ? (
          <div className="space-y-2" role="status" aria-label="Loading your devices">
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-16 w-full" />
          </div>
        ) : devices.isError && !devices.data ? (
          <ErrorState message={(devices.error as Error).message} />
        ) : (
          <ul className="divide-y divide-foreground/[0.07]">
            {list.map((device) => {
              const described = describeDevice(device.user_agent);
              const Icon = ICONS[described.kind];
              const ending = endOne.isPending && endOne.variables === device.id;
              return (
                <li key={device.id} className="flex items-center gap-3 py-3">
                  <span className="glass-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="h-5 w-5 text-foreground/80" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {described.name}
                      {device.is_current && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {deviceLine(device, Date.now())}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => (device.is_current ? void signOut() : endOne.mutate(device.id))}
                    disabled={ending}
                    aria-label={`Sign out of ${described.name}${device.is_current ? " (this device)" : ""}`}
                    className="glass-hover inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-foreground/10 px-3 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    {ending ? "Signing out…" : "Sign out"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!devices.isLoading && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-foreground/[0.07] pt-4">
            <button
              type="button"
              onClick={() =>
                endOthers.mutate(undefined, {
                  onSuccess: (count) =>
                    toast.success(
                      count === 1
                        ? "Signed out of 1 other device"
                        : `Signed out of ${count} other devices`,
                    ),
                })
              }
              disabled={others.length === 0 || endOthers.isPending}
              className={buttonClass}
            >
              Sign out of other devices
            </button>
            <button
              type="button"
              onClick={() => setConfirmAll(true)}
              disabled={endOthers.isPending}
              className={buttonClass}
            >
              Sign out everywhere
            </button>
          </div>
        )}
      </GlassCard>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out everywhere?</AlertDialogTitle>
            <AlertDialogDescription>
              Every device, this one included, goes back to the sign-in page and stops getting
              notifications until you sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <button type="button" onClick={() => setConfirmAll(false)} className={buttonClass}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void signOutEverywhere()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
            >
              Sign out everywhere
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPage>
  );
}
