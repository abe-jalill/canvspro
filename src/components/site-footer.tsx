import { Link } from "@tanstack/react-router";
import { CanvasTrademarkNotice } from "@/components/canvas-trademark-notice";

export function SiteFooter() {
  return (
    <footer className="site-footer mt-auto w-full shrink-0 border-t border-border/30 px-4 py-6 sm:px-6 lg:px-8">
      <CanvasTrademarkNotice className="mx-auto max-w-6xl px-4 pb-4 sm:px-6" />
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} CanvasPro. All rights reserved.</p>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <Link to="/dashboard" className="transition-colors hover:text-foreground">
            Dashboard
          </Link>
          <Link to="/auth" className="transition-colors hover:text-foreground">
            Sign In
          </Link>
          <Link to="/canvas-grade-calculator" className="transition-colors hover:text-foreground">
            Grade Calculator
          </Link>
          <Link to="/canvas-dashboard-guide" className="transition-colors hover:text-foreground">
            Canvas Dashboard Guide
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
          <a
            href="https://forms.gle/7bttezmTW3ji3zFU9"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Report a problem
          </a>
          <a
            href="https://forms.gle/2rSFpsNFBKiRGepE9"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Two-minute survey
          </a>
        </div>
      </div>
    </footer>
  );
}
