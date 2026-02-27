import * as React from "react";

export function Skeleton(props: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={[
        "rounded-md ds-shimmer",
        props.className ?? "",
      ].join(" ")}
      style={props.style}
      aria-hidden
    />
  );
}
