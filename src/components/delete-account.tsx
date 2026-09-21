import { Browser } from "@capacitor/browser";

export function DeleteAccountSection() {
  async function openDeletionPage() {
    await Browser.open({
      url: "https://canvaspro.app/settings#delete-account",
    });
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Deleting your account permanently removes your account and saved data.
        You will complete account deletion securely on the CanvasPro website.
      </p>

      <button
        type="button"
        onClick={openDeletionPage}
        className="glass-hover glass-inset min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-red-500 sm:w-auto"
      >
        Delete my account
      </button>
    </div>
  );
}