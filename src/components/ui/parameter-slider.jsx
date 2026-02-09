import React from "react";
import PropTypes from "prop-types";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ParameterSlider — compact multi-slider block with optional action buttons.
 * - sliders: [{ id, label, min, max, step, value, unit }]
 * - onValueChange: (id, value) => void
 * - responseActions: [{ id, label, variant }]
 * - onResponseAction: (actionId, values) => void
 */
export function ParameterSlider({
  id,
  sliders = [],
  onValueChange,
  responseActions = [],
  onResponseAction,
  className,
}) {
  const handleChange = (sliderId, val) => {
    if (onValueChange) onValueChange(sliderId, val);
  };

  const currentValues = sliders.reduce((acc, s) => {
    acc[s.id] = s.value;
    return acc;
  }, {});

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-[#0b1626] text-foreground shadow-[0_0_0_1px_rgba(0,255,255,0.05)]",
        "p-3 sm:p-4 space-y-3",
        className
      )}
      id={id}
    >
      <div className="space-y-3">
        {sliders.map((slider) => (
          <div key={slider.id} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground/80">
              <span className="uppercase tracking-wide">{slider.label}</span>
              <span className="px-2 py-1 rounded-lg bg-white/5 text-foreground font-semibold text-[11px] border border-white/10">
                {slider.value}
                {slider.unit ? <span className="ml-1 text-muted-foreground/70 text-[10px]">{slider.unit}</span> : null}
              </span>
            </div>
            <Slider
              value={[slider.value]}
              min={slider.min}
              max={slider.max}
              step={slider.step}
              onValueChange={([v]) => handleChange(slider.id, v)}
              className="w-full"
              thumbClassName="h-4 w-4 border border-emerald-300/70 bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
              trackClassName="bg-white/10"
              rangeClassName="bg-gradient-to-r from-emerald-400 to-cyan-400"
            />
          </div>
        ))}
      </div>

      {responseActions.length > 0 && (
        <div className="pt-2 flex items-center justify-end gap-2">
          {responseActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.variant || "ghost"}
              className="h-8 rounded-lg text-xs"
              onClick={() => onResponseAction?.(action.id, currentValues)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

ParameterSlider.propTypes = {
  id: PropTypes.string,
  sliders: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      min: PropTypes.number.isRequired,
      max: PropTypes.number.isRequired,
      step: PropTypes.number,
      value: PropTypes.number.isRequired,
      unit: PropTypes.string,
    })
  ),
  onValueChange: PropTypes.func,
  responseActions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      variant: PropTypes.string,
    })
  ),
  onResponseAction: PropTypes.func,
  className: PropTypes.string,
};

export default ParameterSlider;
