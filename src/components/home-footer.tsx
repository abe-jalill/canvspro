import { Link } from "@tanstack/react-router";

/** The public pages' footer, in their own colors (styles in src/routes/home.css). */
export function HomeFooter() {
  return (
    <footer className="hp-footer">
      <div className="hp-footer__row">
        <span className="hp-brand">CoursePro</span>
        <nav className="hp-footer__links" aria-label="Footer">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/auth">Sign in</Link>
          <Link to="/canvas-grade-calculator">Grade calculator</Link>
          <Link to="/canvas-dashboard-guide">Canvas dashboard guide</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/support">Support</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund-policy">Refunds</Link>
          <a href="mailto:support@canvaspro.app?subject=Accessibility%20help">Accessibility help</a>
          <a href="https://forms.gle/7bttezmTW3ji3zFU9" target="_blank" rel="noopener noreferrer">
            Report a problem
          </a>
          <a href="https://forms.gle/2rSFpsNFBKiRGepE9" target="_blank" rel="noopener noreferrer">
            Two-minute survey
          </a>
        </nav>
      </div>
      <div className="hp-footer__fine">
        <p>© {new Date().getFullYear()} CoursePro. All rights reserved.</p>
        <p className="text-balance">
          CoursePro is an independent tool and is not affiliated with, endorsed by, sponsored by, or
          connected in any way to Canvas LMS or Instructure, Inc.
        </p>
      </div>
    </footer>
  );
}
