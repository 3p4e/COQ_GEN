import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState, type CSSProperties } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

const SIZES: Record<Size, CSSProperties> = {
  sm: { padding: "5px 10px", fontSize: 12, gap: 5 },
  md: { padding: "7px 14px", fontSize: 13, gap: 6 },
  lg: { padding: "10px 18px", fontSize: 14, gap: 7 },
};

export function Button({ variant = "primary", size = "md", icon, fullWidth, children, disabled, style, ...rest }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const palette = paletteFor(variant, hover, !!disabled);
  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        ...SIZES[size], width: fullWidth ? "100%" : undefined,
        borderRadius: "var(--radius-md)", fontFamily: "var(--font-sans)", fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer", transition: "var(--transition-ui)",
        ...palette, ...style,
      }}
    >
      {icon}{children}
    </button>
  );
}

function paletteFor(v: Variant, hover: boolean, disabled: boolean): CSSProperties {
  if (disabled) return { background: "var(--color-slate-200)", color: "var(--text-quaternary)", border: "1px solid var(--color-slate-200)" };
  switch (v) {
    case "primary": return { background: hover ? "var(--color-navy-800)" : "var(--color-brand)", color: "#fff", border: "1px solid transparent" };
    case "secondary": return { background: hover ? "var(--zebra)" : "var(--surface-card)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" };
    case "ghost": return { background: hover ? "var(--zebra)" : "transparent", color: "var(--text-secondary)", border: "1px solid transparent" };
    case "danger": return { background: hover ? "var(--color-red-700)" : "var(--status-fail)", color: "#fff", border: "1px solid transparent" };
  }
}
