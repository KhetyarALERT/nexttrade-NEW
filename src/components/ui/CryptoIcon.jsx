import PropTypes from "prop-types";
import { useState } from "react";

export default function CryptoIcon({ currency, size = "md", className = "" }) {
  const [imgError, setImgError] = useState(false);
  
  const sizeClasses = {
    xs: "w-4 h-4",
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-10 h-10",
    xl: "w-12 h-12"
  };

  const fontSizes = {
    xs: 8,
    sm: 10,
    md: 12,
    lg: 14,
    xl: 16
  };

  const symbol = currency?.toUpperCase();
  
  if (imgError) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-slate-800 text-white font-bold flex items-center justify-center ring-1 ring-white/10 ${className}`}
        style={{ fontSize: fontSizes[size] }}
      >
        {symbol?.charAt(0) || "?"}
      </div>
    );
  }

  const src = `https://cryptoicons.org/api/icon/${symbol?.toLowerCase()}/200`;
  return (
    <img
      src={src}
      alt={symbol}
      className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      onError={() => setImgError(true)}
    />
  );
}

CryptoIcon.propTypes = {
  currency: PropTypes.string.isRequired,
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
  className: PropTypes.string
};