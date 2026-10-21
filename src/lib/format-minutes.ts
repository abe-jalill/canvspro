/** 45 → "45 min", 90 → "1 hr 30 min", 240 → "4 hr" (the iPhone app's wording). */
export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
