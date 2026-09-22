import { Browser } from "@capacitor/browser";
import { isNativeApp } from "@/lib/native";

export async function openExternalUrl(url: string) {
  if (isNativeApp()) {
    await Browser.open({ url, presentationStyle: "popover" });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
