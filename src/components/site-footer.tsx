import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border/30 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} CanvasPro. All rights reserved.</p>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <Link to="/dashboard" className="transition-colors hover:text-foreground">
             {"\n"}
          </Link>
          <Link to="/auth" className="transition-colors hover:text-foreground">
             {"\n"}
          </Link>
          <Link to="/canvas-grade-calculator" className="transition-colors hover:text-foreground">
             {"\n"}
          </Link>
          <Link to="/canvas-dashboard-guide" className="transition-colors hover:text-foreground">
             {"\n"}
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground sm:gap-6">
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
          Survey (Less than 2 minutes!!)
        </a>
      </div>
    </footer>
  );
}
