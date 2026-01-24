import PropTypes from "prop-types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Premium USDT (Tether) icon component with optional tooltip
 * Vector-based, crisp at all sizes
 */
export default function UsdtIcon({ 
  size = "md", 
  showTooltip = false, 
  language = "en",
  className = "" 
}) {
  const sizes = {
    xs: { wh: 16, inner: 10 },
    sm: { wh: 20, inner: 12 },
    md: { wh: 24, inner: 14 },
    lg: { wh: 32, inner: 18 },
    xl: { wh: 40, inner: 22 }
  };

  const { wh, inner } = sizes[size] || sizes.md;

  const tooltipText = language === "ar" 
    ? "USDT (تيثر) — يُستخدم للستاكينغ والتمويل."
    : "USDT (Tether) — used for staking and funding.";

  const icon = (
    <div 
      className={`relative flex items-center justify-center rounded-full bg-[#26A17B] shadow-sm ${className}`}
      style={{ width: wh, height: wh }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: inner, height: inner }}
      >
        {/* Tether T logo */}
        <path
          d="M12 4V8M12 8H7M12 8H17"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 8V20"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );

  if (!showTooltip) return icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {icon}
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="text-xs max-w-[200px]"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

UsdtIcon.propTypes = {
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
  showTooltip: PropTypes.bool,
  language: PropTypes.oneOf(["en", "ar"]),
  className: PropTypes.string
};