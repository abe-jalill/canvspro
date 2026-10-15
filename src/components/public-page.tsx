import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HomeFooter } from "@/components/home-footer";
import { cn } from "@/lib/utils";
import "@/routes/home.css";

/**
 * The homepage's frame for every other public page (pricing, support, legal,
 * guides): the same top bar, colors, type and footer, so the site reads as one.
 */
export function PublicPage({
  children,
  wide = false,
}: {
  children: ReactNode;
  /** Full homepage width instead of a reading column. */
  wide?: boolean;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setIsLoggedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="hp hp-inner">
      <a className="hp-skip" href="#main">
        Skip to content
      </a>
      <header className="hp-bar">
        <Link to="/" className="hp-brand" aria-label="CoursePro home">
          CoursePro
        </Link>
        <nav className="hp-bar__links" aria-label="Main navigation">
          <Link to="/support" preload="intent" className="hp-bar__secondary">
            Support
          </Link>
          {!isLoggedIn && (
            <Link to="/auth" preload="intent">
              Sign in
            </Link>
          )}
          <Link
            to={isLoggedIn ? "/dashboard" : "/signup"}
            preload="intent"
            className="hp-button hp-button--small"
          >
            {isLoggedIn ? "Open app" : "Get started"}
          </Link>
        </nav>
      </header>
      <main id="main" className={cn("hp-page", wide && "hp-page--wide")}>
        {children}
      </main>
      <HomeFooter />
    </div>
  );
}

/** A page's eyebrow, headline and short introduction, in the homepage's type. */
export function PublicPageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="hp-page__head hp-rise">
      <p className="hp-eyebrow">{eyebrow}</p>
      <h1 className="hp-page__title">{title}</h1>
      {children && <div className="hp-page__lede">{children}</div>}
    </header>
  );
}
