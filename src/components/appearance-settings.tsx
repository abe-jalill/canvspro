import { Check, Image as ImageIcon, Monitor, Moon, Square, Sun } from "lucide-react";
import type { CSSProperties } from "react";
import { useTheme } from "@/lib/theme";
import { PALETTES, type ThemeMode, type Wallpaper } from "@/lib/theme-options";
import { GlassCard } from "@/components/glass-card";

export function AppearanceSettings() {
  const { palette, mode, wallpaper, setPalette, setMode, setWallpaper, ready, saving } = useTheme();
  return (
    <GlassCard
      className="appearance-card"
      title="Make yourself at home"
      subtitle="Your colors, saved to your account. A familiar space on every device."
    >
      <fieldset disabled={!ready}>
        <legend className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Color palette
        </legend>
        <div className="appearance-palettes">
          {PALETTES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={palette === option.id}
              onClick={() => setPalette(option.id)}
              className="appearance-palette"
              style={{ "--swatch": option.color } as CSSProperties}
            >
              <span className="appearance-palette__scene" aria-hidden="true">
                <i />
                <i />
                <i />
                <span>{palette === option.id && <Check size={14} />}</span>
              </span>
              <strong>{option.name}</strong>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-6" disabled={!ready}>
        <legend className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Appearance
        </legend>
        <div className="appearance-modes">
          {(
            [
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Monitor },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-pressed={mode === id}
              onClick={() => setMode(id as ThemeMode)}
            >
              <Icon size={16} />
              {label}
              {mode === id && <Check size={14} />}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-6" disabled={!ready}>
        <legend className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Background
        </legend>
        <div className="appearance-modes">
          {(
            [
              { id: "wave", label: "Wallpaper", icon: ImageIcon },
              { id: "plain", label: "Plain color", icon: Square },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-pressed={wallpaper === id}
              onClick={() => setWallpaper(id as Wallpaper)}
            >
              <Icon size={16} />
              {label}
              {wallpaper === id && <Check size={14} />}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="mt-4 min-h-5 text-xs text-muted-foreground" role="status">
        {!ready
          ? "Loading your appearance preferences…"
          : saving
            ? "Saving your appearance…"
            : mode === "system"
              ? "Follows your device’s light or dark appearance."
              : "A space that feels like you."}
      </p>
    </GlassCard>
  );
}
