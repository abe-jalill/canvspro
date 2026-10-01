import { useId } from "react";

export function LegalConsent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="glass-inset flex items-start gap-3 rounded-xl p-4 text-sm text-muted-foreground">
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-foreground"
      />
      <div>
        <label htmlFor={id} className="cursor-pointer">
          I agree to the Terms of Use and Privacy Policy. If I am under the age of legal adulthood,
          I have my parent or guardian’s permission to use CanvasPro.
        </label>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Terms of Use
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
