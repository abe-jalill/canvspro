import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile";

/**
 * Circular profile button shown next to the notification bell in the top bars.
 * Leads to the Profile section of the Settings page.
 */
export function ProfileButton({ className }: { className?: string }) {
  const { data: profile } = useUserProfile();
  const avatarUrl = profile?.avatarUrl;

  return (
    <Link
      to="/settings"
      hash="profile"
      preload="intent"
      aria-label="Profile settings"
      title="Profile"
      className="glass-hover glass-inset relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <UserRound className="h-4 w-4" aria-hidden="true" />
      )}
    </Link>
  );
}
