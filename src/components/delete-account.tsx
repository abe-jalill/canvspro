import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import { purgeAllScopedStorage, useUserScope } from "@/lib/user-scope";
import { syncAuthIdentity } from "@/lib/auth-user";

const CONFIRM_WORD = "DELETE";

export function DeleteAccountSection() {
  const deleteAccount = useServerFn(deleteMyAccount);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scope = useUserScope();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (confirm.trim().toUpperCase() !== CONFIRM_WORD) return;
    setBusy(true);
    try {
      await deleteAccount();
      await queryClient.cancelQueries();
      queryClient.clear();
      purgeAllScopedStorage(scope);
      await supabase.auth.signOut();
      syncAuthIdentity(queryClient, null);
      purgeAllScopedStorage(scope);
      toast.success("Your account and all of its data were deleted.");
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete your account.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Deleting your account permanently removes your Canvas key, class names, schedule, notes, and every other
        saved item. This cannot be undone.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass-hover glass-inset min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-red-500 sm:w-auto"
        >
          Delete my account
        </button>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Type {CONFIRM_WORD} to confirm
            </span>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              placeholder={CONFIRM_WORD}
              className="glass-inset min-h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground/20"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onDelete}
              disabled={busy || confirm.trim().toUpperCase() !== CONFIRM_WORD}
              className="glass-hover min-h-11 w-full rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
              }}
              disabled={busy}
              className="glass-hover glass-inset min-h-11 w-full rounded-xl px-4 text-sm font-medium disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
