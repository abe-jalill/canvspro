import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export const isNativeApp = () => Capacitor.isNativePlatform();

export async function successHaptic() {
  if (!isNativeApp()) return;
  await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
}

export async function selectionHaptic() {
  if (!isNativeApp()) return;
  await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}
