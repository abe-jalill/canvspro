import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/email-verified")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Email verified — Canvas Pro" },
      { name: "description", content: "Your email address has been verified." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmailVerifiedPage,
});

function EmailVerifiedPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-12 w-12 text-foreground/80" />
        <h1 className="mt-4 text-2xl font-normal tracking-tight">Email verified!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is confirmed — you can sign in now.
        </p>
        <Link
          to="/auth"
          className="glass-hover mt-6 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
