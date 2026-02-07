import { useState, useRef, useCallback, useEffect } from "react";
import PropTypes from "prop-types";

const STORAGE_KEY = "copyTradingSplitRatio";
const DEFAULT_RATIO = 0.65;
const MIN_TOP = 320;
const MIN_BOTTOM = 180;
const MAX_TOP_RATIO = 0.8;

/**
 * Resizable vertical splitter between chart (top) and positions (bottom).
 * Persists ratio in localStorage. Calls onResize when ratio changes.
 */
export default function ResizableSplitter({ topContent, bottomContent, onResize, className = "" }) {
  const containerRef = useRef(null);
  const [ratio, setRatio] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        if (Number.isFinite(parsed) && parsed > 0.2 && parsed < 0.95) return parsed;
      }
    } catch {}
    return DEFAULT_RATIO;
  });
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startRatioRef = useRef(0);

  const clampRatio = useCallback((r) => {
    if (!containerRef.current) return r;
    const h = containerRef.current.clientHeight;
    if (h <= 0) return r;
    const minTopR = MIN_TOP / h;
    const minBottomR = 1 - (MIN_BOTTOM / h);
    return Math.min(MAX_TOP_RATIO, Math.max(minTopR, Math.min(minBottomR, r)));
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startRatioRef.current = ratio;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [ratio]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    draggingRef.current = true;
    startYRef.current = e.touches[0].clientY;
    startRatioRef.current = ratio;
  }, [ratio]);

  useEffect(() => {
    const handleMove = (clientY) => {
      if (!draggingRef.current || !containerRef.current) return;
      const h = containerRef.current.clientHeight;
      if (h <= 0) return;
      const delta = clientY - startYRef.current;
      const newRatio = clampRatio(startRatioRef.current + delta / h);
      setRatio(newRatio);
    };

    const handleMouseMove = (e) => handleMove(e.clientY);
    const handleTouchMove = (e) => {
      if (e.touches.length === 1) handleMove(e.touches[0].clientY);
    };

    const handleEnd = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setRatio(prev => {
        try { localStorage.setItem(STORAGE_KEY, String(prev)); } catch {}
        onResize?.();
        return prev;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [clampRatio, onResize]);

  // Notify on ratio change for chart resize
  useEffect(() => {
    onResize?.();
  }, [ratio]);

  const topPct = `${(ratio * 100).toFixed(2)}%`;
  const bottomPct = `${((1 - ratio) * 100).toFixed(2)}%`;

  return (
    <div ref={containerRef} className={`flex flex-col h-full ${className}`}>
      {/* Top (Chart) */}
      <div style={{ height: topPct }} className="min-h-0 overflow-hidden">
        {topContent}
      </div>

      {/* Drag Handle */}
      <div
        className="h-[6px] shrink-0 cursor-row-resize flex items-center justify-center group relative z-10 select-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize chart and positions"
      >
        <div className="absolute inset-x-0 -top-2 -bottom-2" /> {/* Larger hit area */}
        <div className="w-8 h-[3px] rounded-full bg-border/40 group-hover:bg-primary/50 group-active:bg-primary transition-colors" />
      </div>

      {/* Bottom (Positions) */}
      <div style={{ height: bottomPct }} className="min-h-0 overflow-hidden">
        {bottomContent}
      </div>
    </div>
  );
}

ResizableSplitter.propTypes = {
  topContent: PropTypes.node.isRequired,
  bottomContent: PropTypes.node.isRequired,
  onResize: PropTypes.func,
  className: PropTypes.string,
};