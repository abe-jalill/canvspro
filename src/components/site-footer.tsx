import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border/30 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Canvas Pro. All rights reserved.</p>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <Link to="/canvas-grade-calculator" className="transition-colors hover:text-foreground">
            Grade Calculator
          </Link>
          <Link to="/canvas-dashboard-guide" className="transition-colors hover:text-foreground">
            Canvas Dashboard Guide
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            className="transition-colors hover:text-foreground"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="transition-colors hover:text-foreground"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
