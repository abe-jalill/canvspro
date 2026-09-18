/** Full-screen loading circle shown while every page warms up after sign-in. */
export function AppWarmupSplash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background px-6">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-foreground/15 border-t-foreground/70"
        role="status"
        aria-label="Loading"
      />
      <p className="text-center text-sm font-normal text-muted-foreground">Getting your Canvas data ready…</p>
    </div>
  );
}
