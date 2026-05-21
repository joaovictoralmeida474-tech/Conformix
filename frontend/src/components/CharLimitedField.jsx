function getRemaining(value, maxLength) {
  return Math.max(0, maxLength - String(value ?? "").length);
}

export default function CharLimitedField({
  label,
  value,
  onChange,
  maxLength,
  as = "input",
  className = "supplier-form-input",
  placeholder,
  helperText,
  fullWidth = false
}) {
  const remaining = getRemaining(value, maxLength);
  const InputTag = as === "textarea" ? "textarea" : "input";
  const counterClass = [
    "field-char-counter",
    remaining <= 10 ? "is-low" : "",
    remaining === 0 ? "is-limit" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`supplier-form-field supplier-form-field-limited${fullWidth ? " supplier-form-field-full" : ""}`}>
      <label>{label}</label>
      <div className="field-char-counter-wrap">
        <InputTag
          className={className}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={onChange}
        />
        <span className={counterClass} aria-live="polite">
          {remaining} {remaining === 1 ? "restante" : "restantes"}
        </span>
      </div>
      {helperText ? <p className="supplier-helper-text">{helperText}</p> : null}
    </div>
  );
}
