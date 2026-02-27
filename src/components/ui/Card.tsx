import * as React from "react";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return (
    <div
      {...rest}
      className={["ds-surface", className].join(" ")}
    />
  );
}
