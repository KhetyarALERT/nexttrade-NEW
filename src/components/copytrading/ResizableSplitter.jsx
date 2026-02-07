import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "copyTradingSplitRatio";
const MIN_CHART_H = 320;
const MIN_TABLE_H = 180;
const MAX_CHART_RATIO = 0.8;

/**
 * Vertical resizable splitter between chart (top) and positions table (bottom).
 * Persists split ratio in localStorage.
 *
 * Props:
 *   topContent — chart JSX
 *   bottomContent — positions table JSX
 *   onResize — optional callback after resize (e.g. to trigger chart.resize)
 */
export default function ResizableSplitter({ topContent, bottomContent, onResize }) {
  const containerRef = useRef(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startRatio = useRef(0);

  const [ratio, setRatio] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const val = parseFloat(stored);
      if (Number.isFinite(val) && val >= 0.3 && val <= MAX_CHART_RATIO) return val;
    } catch {}
    return 0.65;
  });

  // Persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(ratio)); } catch {}
  }, [ratio]);

  // Notify parent (chart resize)
  useEffect(() => {
    const timer = setTimeout(() => onResize?.(), 50);
    return () => clearTimeout(timer);
  }, [ratio, onResize]);

  const clampRatio = useCallback((r) => {
    const el = containerRef.current;
    if (!el) return Math.max(0.3, Math.min(MAX_CHART_RATIO, r));
    const totalH = el.clientHeight;
    const chartH = totalH * r;
    const tableH = totalH - chartH;
    if (chartH < MIN_CHART_H) return MIN_CHART_H / totalH;
    if (tableH < MIN_TABLE_H) return (totalH - MIN_TABLE_H) / totalH;
    if (r > MAX_CHART_RATIO) return MAX_CHART_RATIO;
    return r;
  }, []);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startRatio.current = ratio;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [ratio]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const totalH = containerRef.current.clientHeight;
      if (totalH < 100) return;
      const delta = e.clientY - startY.current;
      const newRatio = clampRatio(startRatio.current + delta / totalH);
      setRatio(newRatio);
    };

    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [clampRatio]);

  const topPct = `${(ratio * 100).toFixed(2)}%`;
  const bottomPct = `${((1 - ratio) * 100).toFixed(2)}%`;

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Chart */}
      <div style={{ height: topPct, minHeight: MIN_CHART_H }} className="min-h-0 overflow-hidden">
        {topContent}
      </div>

      {/* Drag Handle */}
      <div
        onMouseDown={onMouseDown}
        className="h-[6px] shrink-0 cursor-row-resize relative group z-10 flex items-center justify-center"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize chart and positions"
      >
        <div className="absolute inset-0 bg-border/30 group-hover:bg-primary/20 transition-colors" />
        <div className="relative w-8 h-[3px] rounded-full bg-muted-foreground/20 group-hover:bg-primary/50 transition-colors" />
      </div>

      {/* Positions Table */}
      <div style={{ height: bottomPct, minHeight: MIN_TABLE_H }} className="min-h-0 overflow-hidden">
        {bottomContent}
      </div>
    </div>
  );
}