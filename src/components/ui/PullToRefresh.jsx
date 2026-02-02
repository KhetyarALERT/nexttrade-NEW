import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * PullToRefresh wrapper component for mobile pull-to-refresh gesture
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child content
 * @param {Function} props.onRefresh - Async function to call on refresh
 * @param {boolean} props.disabled - Disable pull to refresh
 */
export default function PullToRefresh({ children, onRefresh, disabled = false }) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const THRESHOLD = 80; // Distance to trigger refresh
  const MAX_PULL = 120; // Maximum pull distance

  const handleTouchStart = useCallback((e) => {
    if (disabled || refreshing) return;
    
    // Only enable if at top of scroll
    const scrollTop = containerRef.current?.scrollTop || window.scrollY;
    if (scrollTop > 5) return;

    startY.current = e.touches[0].clientY;
    setPulling(true);
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pulling || disabled || refreshing) return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0) {
      // Apply resistance to pull
      const resistance = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(resistance);
      
      // Prevent default scroll when pulling down
      if (diff > 10) {
        e.preventDefault();
      }
    }
  }, [pulling, disabled, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);

    if (pullDistance >= THRESHOLD && onRefresh && !refreshing) {
      setRefreshing(true);
      setPullDistance(60); // Keep indicator visible during refresh
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pulling, pullDistance, onRefresh, refreshing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = progress * 180;

  return (
    <div ref={containerRef} className="relative min-h-full">
      {/* Pull indicator */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center transition-all duration-200 pointer-events-none"
        style={{ 
          top: Math.max(pullDistance - 50, -50),
          opacity: pullDistance > 10 ? 1 : 0,
          transform: `translateX(-50%) translateY(${pullDistance > 10 ? 0 : -20}px)`
        }}
      >
        <div 
          className={`w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center transition-all duration-200 ${
            refreshing ? 'bg-primary/10' : pullDistance >= THRESHOLD ? 'bg-emerald-500/20 border-emerald-500/50' : ''
          }`}
        >
          <RefreshCw 
            className={`w-5 h-5 transition-all duration-200 ${
              refreshing 
                ? 'animate-spin text-primary' 
                : pullDistance >= THRESHOLD 
                  ? 'text-emerald-500' 
                  : 'text-muted-foreground'
            }`}
            style={{ transform: refreshing ? undefined : `rotate(${rotation}deg)` }}
          />
        </div>
      </div>
      
      {/* Content wrapper with pull offset */}
      <div 
        className="transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${refreshing ? 60 : pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}