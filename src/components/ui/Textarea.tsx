import * as React from "react";

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    error?: string;
  },
) {
  const { className = "", label, error, id, ...rest } = props;
  const autoId = React.useId();
  const textareaId = id ?? autoId;

  return (
    <div className="ds-field">
      {label ? (
        <label htmlFor={textareaId} className="ds-label">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        {...rest}
        className={[
          "ds-textarea",
          error ? "ds-input-error" : "",
          className,
        ].join(" ")}
      />
      {error ? <div className="ds-error">{error}</div> : null}
    </div>
  );
}
