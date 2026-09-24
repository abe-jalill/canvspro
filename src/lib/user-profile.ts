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
  username: string;
  avatarPath: string;
  avatarUrl: string;
}

export const PROFILE_STORAGE_BASE_KEY = "canvas_user_profile";

// Per-account namespacing: a second account signing in on the same device
// must never inherit the previous user's profile.
function profileKey(): string {
  return scopedKey(PROFILE_STORAGE_BASE_KEY);
}

export function getLocalProfile(): UserProfile {
  if (typeof window === "undefined") {
    return emptyProfile();
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
  return {
    firstName: "",
    lastName: "",
    nickname: "",
    school: "",
    major: "",
    classOf: "",
    username: "",
    avatarPath: "",
    avatarUrl: "",
  };
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameValidationMessage(value: string): string | null {
  const username = normalizeUsername(value);
  if (!username) return null;
  if (username.length < 3 || username.length > 24) return "Use 3–24 characters.";
  if (!/^[a-z0-9_]+$/.test(username)) return "Use only letters, numbers, and underscores.";
  return null;
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
  const userId = userData.user?.id;
  const { data: accountProfile } = userId
    ? await supabase
        .from("account_profiles")
        .select("username, avatar_path")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const [fullNameFirst = "", ...fullNameRest] = fullName.split(/\s+/).filter(Boolean);
  const avatarPath = accountProfile?.avatar_path || meta.avatar_path || local.avatarPath || "";
  let avatarUrl = "";
  if (avatarPath) {
    const { data } = await supabase.storage.from("profile-avatars").createSignedUrl(avatarPath, 3600);
    avatarUrl = data?.signedUrl ?? "";
  }

  const profile: UserProfile = {
    firstName: meta.first_name || meta.firstName || local.firstName || fullNameFirst,
    lastName: meta.last_name || meta.lastName || local.lastName || fullNameRest.join(" "),
    nickname: meta.nickname || local.nickname || "",
    school: meta.school || local.school || "",
    major: meta.major || local.major || "",
    classOf: meta.class_of || meta.classOf || local.classOf || "",
    username: accountProfile?.username || meta.username || local.username || "",
    avatarPath,
    avatarUrl,
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
    initialDataUpdatedAt: 0,
  });
}

export function useSaveUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      const usernameError = usernameValidationMessage(profile.username);
      if (usernameError) throw new Error(usernameError);
      const username = normalizeUsername(profile.username);
      const { error: usernameSaveError } = await supabase.rpc("set_username", {
        requested_username: username,
      });
      if (usernameSaveError) {
        if (usernameSaveError.code === "23505" || /already taken/i.test(usernameSaveError.message)) {
          throw new Error("That username is already taken.");
        }
        throw usernameSaveError;
      }

      const fullName = `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim();
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: profile.firstName.trim(),
          last_name: profile.lastName.trim(),
          nickname: profile.nickname.trim(),
          school: profile.school.trim(),
          major: profile.major.trim(),
          class_of: profile.classOf.trim(),
          username,
          avatar_path: profile.avatarPath || null,
          full_name: fullName,
          profile_setup_prompted: true,
          profile_setup_completed: Boolean(profile.firstName.trim() && profile.lastName.trim()),
        },
      });

      if (error) throw error;
      const saved = { ...profile, username };
      saveLocalProfile(saved);
      return saved;
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

export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (usernameValidationMessage(username)) return false;
  const normalized = normalizeUsername(username);
  if (!normalized) return true;
  const { data, error } = await supabase.rpc("username_available", {
    requested_username: normalized,
  });
  if (error) throw error;
  return data;
}

export async function uploadProfileAvatar(file: File): Promise<{ path: string; url: string }> {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowed.has(file.type)) throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Profile pictures must be 5 MB or smaller.");

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sign in before uploading a profile picture.");

  const path = `${userId}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from("profile-avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { error: pathError } = await supabase.rpc("set_avatar_path", { requested_path: path });
  if (pathError) throw pathError;
  const { error: metadataError } = await supabase.auth.updateUser({ data: { avatar_path: path } });
  if (metadataError) throw metadataError;

  const { data } = await supabase.storage.from("profile-avatars").createSignedUrl(path, 3600);
  if (!data?.signedUrl) throw new Error("Could not display the uploaded profile picture.");
  return { path, url: `${data.signedUrl}&v=${Date.now()}` };
}

export async function removeProfileAvatar(path: string): Promise<void> {
  if (path) {
    const { error } = await supabase.storage.from("profile-avatars").remove([path]);
    if (error) throw error;
  }
  const { error: pathError } = await supabase.rpc("set_avatar_path", { requested_path: null });
  if (pathError) throw pathError;
  const { error: metadataError } = await supabase.auth.updateUser({ data: { avatar_path: null } });
  if (metadataError) throw metadataError;
}
