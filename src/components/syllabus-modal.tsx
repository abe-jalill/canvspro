import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SyllabusModalProps {
  title: string;
  html: string;
  onClose: () => void;
}

export function SyllabusModal({ title, html, onClose }: SyllabusModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} syllabus`}
    >
      <button
        onClick={onClose}
        aria-label="Close syllabus"
        className="absolute inset-0 bg-background/60 backdrop-blur-md"
      />
      <div className="glass-panel-strong relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden p-0">
        <header className="flex items-center justify-between gap-4 border-b border-glass-border px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Syllabus
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="glass-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-glass-border"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="syllabus-body overflow-y-auto px-6 py-5 text-sm leading-relaxed">
          <div
            // Canvas returns sanitized HTML; render as-is inside a scoped container.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
