/** Lightweight UI shown while the native router restores the signed-in route. */
export function AppLaunchShell() {
  return (
    <div className="launch-shell" role="status" aria-label="Opening CanvasPro">
      <div className="launch-shell__brand" aria-hidden="true">
        CP
      </div>
      <span className="launch-shell__name">CanvasPro</span>
      <div className="launch-shell__bar" aria-hidden="true" />
    </div>
  );
}
