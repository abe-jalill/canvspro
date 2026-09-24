import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { scopedKey } from "@/lib/user-scope";
import { toast } from "sonner";

export interface UserProfile {
  firstName: string;
  lastName: string;
  nickname: string;
  school: string;
  major: string;
  classOf: string;
}

export const PROFILE_STORAGE_BASE_KEY = "canvas_user_profile";

// Per-account namespacing: a second account signing in on the same device
// must never inherit the previous user's profile.
function profileKey(): string {
  return scopedKey(PROFILE_STORAGE_BASE_KEY);
}

export function getLocalProfile(): UserProfile {
  if (typeof window === "undefined") {
    return { firstName: "", lastName: "", nickname: "", school: "", major: "", classOf: "" };
  }
  try {
    const raw = localStorage.getItem(profileKey());
    if (raw) return { ...emptyProfile(), ...JSON.parse(raw) };
  } catch {
    // Ignore parse error
  }
  return emptyProfile();
}

function emptyProfile(): UserProfile {
  return { firstName: "", lastName: "", nickname: "", school: "", major: "", classOf: "" };
}

export function saveLocalProfile(profile: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(profileKey(), JSON.stringify(profile));
  } catch {
    // Ignore storage error
  }
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const { data: userData } = await supabase.auth.getUser();
  const meta = userData.user?.user_metadata ?? {};
  const local = getLocalProfile();

  const profile: UserProfile = {
    firstName: meta.first_name || meta.firstName || local.firstName || "",
    lastName: meta.last_name || meta.lastName || local.lastName || "",
    nickname: meta.nickname || local.nickname || "",
    school: meta.school || local.school || "",
    major: meta.major || local.major || "",
    classOf: meta.class_of || meta.classOf || local.classOf || "",
  };

  saveLocalProfile(profile);
  return profile;
}

export function useUserProfile() {
  return useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
    staleTime: 60_000,
    initialData: getLocalProfile,
  });
}

export function useSaveUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      const fullName = `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim();
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: profile.firstName.trim(),
          last_name: profile.lastName.trim(),
          nickname: profile.nickname.trim(),
          school: profile.school.trim(),
          major: profile.major.trim(),
          class_of: profile.classOf.trim(),
          full_name: fullName,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
      saveLocalProfile(profile);
      return profile;
    },
    onSuccess: (profile) => {
      qc.setQueryData(["user-profile"], profile);
      qc.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Profile saved successfully");
    },
    onError: (err: Error) => {
      toast.error("Could not save profile", { description: err.message });
    },
  });
}
