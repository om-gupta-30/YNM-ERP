import * as React from "react";

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string },
) {
  const { className = "", label, error, id, ...rest } = props;
  const autoId = React.useId();
  const inputId = id ?? autoId;

  return (
    <div className="ds-field">
      {label ? (
        <label htmlFor={inputId} className="ds-label">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        {...rest}
        className={[
          "ds-input",
          error ? "ds-input-error" : "",
          className,
        ].join(" ")}
      />
      {error ? <div className="ds-error">{error}</div> : null}
    </div>
  );
}
