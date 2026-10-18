export const MAX_ESTIMATE_MINUTES = 480;

export function parseEstimateMinutes(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_ESTIMATE_MINUTES
    ? minutes
    : null;
}

export function formatEstimateMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}
