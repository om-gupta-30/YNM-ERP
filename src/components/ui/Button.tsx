import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
  },
) {
  const { className = "", variant = "primary", size = "md", ...rest } = props;

  const base =
    "inline-flex items-center justify-center rounded-lg font-medium " +
    "transition-all duration-200 ease-out " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
    "active:scale-[0.97]";

  const sizes: Record<Size, string> = {
    xs: "h-7 px-2.5 text-xs gap-1",
    sm: "h-8 px-3 text-sm gap-1.5",
    md: "h-9 px-4 text-sm gap-2",
  };

  const variants: Record<Variant, string> = {
    primary:
      "bg-gradient-to-b from-gold-500 to-gold-600 text-gold-950 shadow-sm shadow-gold-500/20 " +
      "hover:from-gold-400 hover:to-gold-500 hover:shadow-md hover:shadow-gold-500/25",
    secondary:
      "bg-white text-stone-700 border border-stone-200 shadow-sm " +
      "hover:bg-stone-50 hover:text-stone-900 hover:border-stone-300 hover:shadow-md",
    ghost:
      "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
    danger:
      "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm shadow-red-500/20 " +
      "hover:from-red-400 hover:to-red-500 hover:shadow-md hover:shadow-red-500/25",
  };

  return (
    <button
      {...rest}
      className={[base, sizes[size], variants[variant], className].join(" ")}
    />
  );
}
