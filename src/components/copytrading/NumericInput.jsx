import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { cn } from "@/lib/utils";

/**
 * Clean numeric input with external suffix label.
 * Handles: clamping, empty-safe, mobile decimal keyboard, tabular-nums display.
 */
export default function NumericInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  className,
  inputClassName,
  disabled,
}) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));

  // Sync external value when not focused (avoids cursor jump while typing)
  React.useEffect(() => {
    if (!focused) {
      setLocalValue(String(value));
    }
  }, [value, focused]);

  const handleChange = useCallback((e) => {
    const raw = e.target.value;
    setLocalValue(raw);
    const num = Number(raw);
    if (raw !== "" && !isNaN(num)) {
      const clamped = max !== undefined ? Math.min(max, Math.max(min, num)) : Math.max(min, num);
      onChange(clamped);
    }
  }, [onChange, min, max]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const num = Number(localValue);
    if (localValue === "" || isNaN(num)) {
      setLocalValue(String(min));
      onChange(min);
    } else {
      const clamped = max !== undefined ? Math.min(max, Math.max(min, num)) : Math.max(min, num);
      setLocalValue(String(clamped));
      onChange(clamped);
    }
  }, [localValue, onChange, min, max]);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <input
        type="text"
        inputMode="decimal"
        value={focused ? localValue : value}
        onChange={handleChange}
        onFocus={() => { setFocused(true); setLocalValue(String(value)); }}
        onBlur={handleBlur}
        step={step}
        disabled={disabled}
        className={cn(
          "w-16 h-7 px-2 rounded-lg border border-border/50 bg-background/60",
          "text-xs font-mono tabular-nums text-right",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
          "transition-all disabled:opacity-50",
          inputClassName
        )}
      />
      {suffix && (
        <span className="text-[10px] text-muted-foreground font-medium shrink-0">{suffix}</span>
      )}
    </div>
  );
}

NumericInput.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
  step: PropTypes.number,
  suffix: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  disabled: PropTypes.bool,
};