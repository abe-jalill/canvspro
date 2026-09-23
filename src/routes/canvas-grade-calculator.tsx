import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

const TITLE = "Canvas Grade Calculator — Weighted Grades & Final Exam";
const DESCRIPTION =
  "Free Canvas grade calculator: work out your weighted course grade and the score you need on the final exam. No login, no account.";

export const Route = createFileRoute("/canvas-grade-calculator")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://canvaspro.app/canvas-grade-calculator" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://canvaspro.app/canvas-grade-calculator" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Canvas Grade Calculator",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          url: "https://canvaspro.app/canvas-grade-calculator",
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: CalculatorPage,
});

interface Row {
  id: number;
  name: string;
  weight: string;
  score: string;
}

const START_ROWS: Row[] = [
  { id: 1, name: "Homework", weight: "20", score: "92" },
  { id: 2, name: "Quizzes", weight: "20", score: "85" },
  { id: 3, name: "Midterm", weight: "25", score: "78" },
  { id: 4, name: "Final exam", weight: "35", score: "" },
];

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function letterFor(pct: number): string {
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 67) return "D+";
  if (pct >= 60) return "D";
  return "F";
}

function inputClass() {
  return "glass-inset min-h-11 w-full rounded-xl bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-foreground/30";
}

function CalculatorPage() {
  const [rows, setRows] = useState<Row[]>(START_ROWS);
  const [nextId, setNextId] = useState(5);
  const [target, setTarget] = useState("90");

  const update = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const result = useMemo(() => {
    let gradedWeight = 0;
    let earned = 0;
    let ungradedWeight = 0;
    let totalWeight = 0;

    for (const r of rows) {
      const w = num(r.weight);
      const s = num(r.score);
      if (w == null || w <= 0) continue;
      totalWeight += w;
      if (s == null) {
        ungradedWeight += w;
      } else {
        gradedWeight += w;
        earned += (s / 100) * w;
      }
    }

    const currentPct = gradedWeight > 0 ? (earned / gradedWeight) * 100 : null;
    const projectedPct = totalWeight > 0 ? (earned / totalWeight) * 100 : null;

    const t = num(target);
    let needed: number | null = null;
    if (t != null && ungradedWeight > 0 && totalWeight > 0) {
      needed = ((t / 100) * totalWeight - earned) / (ungradedWeight / 100);
    }

    return {
      currentPct,
      projectedPct,
      gradedWeight,
      ungradedWeight,
      totalWeight,
      needed,
    };
  }, [rows, target]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Free tool
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Canvas grade calculator
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Enter each assignment group's weight and your score. Leave a score blank
          for work that isn't graded yet — the calculator shows your grade now, your
          projected grade, and what you need on what's left.
        </p>
      </header>

      <section className="glass-panel-strong mt-10 p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Weighted grade</h2>
        <div className="mt-4 space-y-3">
          <div className="hidden gap-3 px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground sm:grid sm:grid-cols-[1fr_7rem_7rem_2.5rem]">
            <span>Group</span>
            <span>Weight %</span>
            <span>Your score %</span>
            <span className="sr-only">Remove</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid gap-3 sm:grid-cols-[1fr_7rem_7rem_2.5rem] sm:items-center"
            >
              <input
                aria-label="Assignment group name"
                className={inputClass()}
                value={r.name}
                placeholder="Homework"
                onChange={(e) => update(r.id, { name: e.target.value })}
              />
              <input
                aria-label={`${r.name || "Group"} weight percent`}
                className={inputClass()}
                value={r.weight}
                inputMode="decimal"
                placeholder="20"
                onChange={(e) => update(r.id, { weight: e.target.value })}
              />
              <input
                aria-label={`${r.name || "Group"} score percent`}
                className={inputClass()}
                value={r.score}
                inputMode="decimal"
                placeholder="—"
                onChange={(e) => update(r.id, { score: e.target.value })}
              />
              <button
                onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                aria-label={`Remove ${r.name || "row"}`}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-foreground/15 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setRows((prev) => [
              ...prev,
              { id: nextId, name: "", weight: "", score: "" },
            ]);
            setNextId((n) => n + 1);
          }}
          className="glass-inset glass-hover mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add group
        </button>

        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Grade now"
            value={
              result.currentPct != null
                ? `${result.currentPct.toFixed(1)}% · ${letterFor(result.currentPct)}`
                : "—"
            }
            note={`Based on ${result.gradedWeight}% of the course graded`}
          />
          <Stat
            label="Projected"
            value={
              result.projectedPct != null && result.ungradedWeight > 0
                ? `${result.projectedPct.toFixed(1)}%`
                : result.currentPct != null
                  ? `${result.currentPct.toFixed(1)}%`
                  : "—"
            }
            note="If ungraded work scores zero"
          />
          <Stat
            label="Weights total"
            value={`${result.totalWeight}%`}
            note={
              result.totalWeight === 100
                ? "Adds up correctly"
                : "Canvas expects weights to total 100%"
            }
          />
        </dl>
      </section>

      <section className="glass-panel-strong mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          What do I need on the final?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Uses every row above that still has a blank score.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Grade I want
            </span>
            <input
              className={inputClass() + " w-32"}
              value={target}
              inputMode="decimal"
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <div className="glass-inset flex-1 p-4">
            {result.ungradedWeight <= 0 ? (
              <p className="text-sm text-muted-foreground">
                Every group has a score, so there's nothing left to calculate.
              </p>
            ) : result.needed == null ? (
              <p className="text-sm text-muted-foreground">
                Enter a target grade to see what you need.
              </p>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums">
                  {result.needed.toFixed(1)}%
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  needed across the remaining {result.ungradedWeight}% of your grade
                  {result.needed > 100 && " — not reachable, aim for the next grade down"}
                  {result.needed <= 0 && " — you've already secured it"}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 space-y-6">
        <div className="glass-panel p-6">
          <h2 className="text-xl font-semibold tracking-tight">
            How Canvas calculates your grade
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Canvas shows two numbers. The <strong className="text-foreground">current
              grade</strong> counts only graded work, which is what this calculator's
              "grade now" matches. The <strong className="text-foreground">total
              grade</strong> counts ungraded assignments as zeros — that's the
              "projected" figure. Tick "Calculate based only on graded assignments"
              in the Canvas Grades page to switch between them.
            </p>
            <p>
              When a course uses assignment groups with weights, each group is
              averaged on its own and then multiplied by its weight. A 95% in a
              group worth 10% moves your grade far less than an 80% in a group
              worth 40%. If weights don't total 100%, Canvas scales them
              proportionally.
            </p>
            <p>
              Dropped scores are applied inside the group before weighting, so a
              "lowest quiz dropped" rule changes that group's average only. Excused
              work is removed from the calculation entirely, unlike a zero.
            </p>
            <p>
              Your instructor may also hide totals or leave grades unposted, in
              which case Canvas shows nothing even though scores exist. That's a
              posting policy, not a calculation error.
            </p>
          </div>
        </div>

        <div className="glass-panel-strong flex flex-col items-start gap-4 p-6">
          <h2 className="text-xl font-semibold tracking-tight">
            Stop doing this by hand
          </h2>
          <p className="text-sm text-muted-foreground">
            CanvasPro pulls your real scores straight from Canvas and keeps every
            class, assignment, and announcement on one dashboard you arrange
            yourself — with trend arrows when a grade moves. Every feature is
            free, with no subscription required.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="glass-hover inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
            >
              Try CanvasPro
            </Link>
            <Link
              to="/canvas-dashboard-guide"
              className="glass-inset glass-hover inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
            >
              Customize your Canvas dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="glass-inset p-4">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
