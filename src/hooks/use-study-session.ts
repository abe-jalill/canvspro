import { useCallback, useEffect, useState } from "react";
import { useScopedKey } from "@/lib/user-scope";
import {
  isStudySessionSnapshot,
  publishStudySessionSnapshot,
  STUDY_SESSION_STORAGE_KEY,
  type StudySessionSnapshot,
} from "@/lib/study-session";

export function useStudySession() {
  const key = useScopedKey(STUDY_SESSION_STORAGE_KEY);
  const [session, setSessionState] = useState<StudySessionSnapshot | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    let restored: StudySessionSnapshot | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (isStudySessionSnapshot(parsed)) restored = parsed;
      else if (raw) window.localStorage.removeItem(key);
    } catch {
      // Invalid or unavailable storage should never prevent a session.
    }
    setSessionState(restored);
    publishStudySessionSnapshot(restored);
    setReady(true);
  }, [key]);

  const setSession = useCallback(
    (next: StudySessionSnapshot | null) => {
      setSessionState(next);
      try {
        if (next) window.localStorage.setItem(key, JSON.stringify(next));
        else window.localStorage.removeItem(key);
      } catch {
        // Keep the in-memory session usable when storage is unavailable.
      }
      publishStudySessionSnapshot(next);
    },
    [key],
  );

  return { session, setSession, ready };
}
