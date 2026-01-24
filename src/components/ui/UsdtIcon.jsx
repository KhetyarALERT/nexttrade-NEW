import PropTypes from "prop-types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Official USDT (Tether) logo icon component
 * Uses the official Tether brand SVG, crisp at all sizes
 */
export default function UsdtIcon({ 
  size = "md", 
  showTooltip = false, 
  language = "en",
  className = "",
  title
}) {
  const sizes = {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40
  };

  const wh = sizes[size] || sizes.md;

  const tooltipText = language === "ar" 
    ? "USDT (تيثر)"
    : "USDT (Tether)";

  const ariaLabel = title || tooltipText;

  // Official Tether logo SVG
  const icon = (
    <svg
      viewBox="0 0 339.43 295.27"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={`flex-shrink-0 ${className}`}
      style={{ width: wh, height: wh }}
    >
      <title>{ariaLabel}</title>
      {/* Green circular background */}
      <circle cx="169.72" cy="147.64" r="147.64" fill="#26A17B" />
      {/* White Tether T mark */}
      <path
        fill="#FFFFFF"
        d="M190.87,132.64v-26.37h38.65V71.37H110.14v34.9h38.65v26.32c-42.26,1.88-74.02,10.19-74.02,20.19
        c0,11.19,38.53,20.27,86.07,20.27s86.07-9.08,86.07-20.27C246.92,142.83,215.14,134.52,190.87,132.64z M169.24,164.31
        c-38.88,0-70.4-5.87-70.4-13.1c0-5.76,21.1-10.68,50.79-12.43v19.86c6.32,0.41,12.91,0.63,19.74,0.63
        c6.7,0,13.18-0.22,19.39-0.61v-19.91c29.82,1.74,51.05,6.67,51.05,12.46C239.81,158.44,208.22,164.31,169.24,164.31z"
      />
    </svg>
  );

  if (!showTooltip) return icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{icon}</span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="text-xs"
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
  className: PropTypes.string,
  title: PropTypes.string
};