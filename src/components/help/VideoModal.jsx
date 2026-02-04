import { useEffect, useCallback, useState, useRef } from "react";
import PropTypes from "prop-types";
import { X, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Responsive Video Modal
 * - Mobile: full-screen with safe padding
 * - Desktop: centered, max-width 900px, 16:9
 * - Stops playback on close by unmounting iframe
 * - Closes on X, ESC, backdrop click
 */
export default function VideoModal({ open, onClose, youtubeId, title }) {
  // ESC key handler
  useEffect(() => {
    if (!open) return;
    
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    
    document.addEventListener("keydown", handleEsc);
    
    // Scroll lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const [loadState, setLoadState] = useState("loading"); // loading | loaded | error
  const iframeRef = useRef(null);
  const loadTimeoutRef = useRef(null);

  // Reset load state when video changes
  useEffect(() => {
    if (open && youtubeId) {
      setLoadState("loading");
      
      // Fallback timeout - if iframe doesn't load in 5s, show fallback
      loadTimeoutRef.current = setTimeout(() => {
        if (loadState === "loading") {
          setLoadState("error");
        }
      }, 5000);
    }
    
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [open, youtubeId]);

  const handleIframeLoad = useCallback(() => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setLoadState("loaded");
  }, []);

  const handleIframeError = useCallback(() => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setLoadState("error");
  }, []);

  const handleOpenYouTube = useCallback(() => {
    window.open(`https://youtu.be/${youtubeId}`, "_blank", "noopener,noreferrer");
  }, [youtubeId]);

  if (!open) return null;

  // Use youtube-nocookie.com for better embed compatibility + proper params
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(origin)}`;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Video"}
    >
      {/* Modal Container */}
      <div className="relative w-full h-full sm:h-auto sm:max-w-[900px] sm:rounded-2xl overflow-hidden bg-black flex flex-col">
        
        {/* Close Button - Always visible, positioned for mobile reach */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full h-10 w-10"
          aria-label="Close video"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Title Bar - Mobile only for context */}
        {title && (
          <div className="sm:hidden bg-black/90 px-4 py-3 text-white text-sm font-medium truncate">
            {title}
          </div>
        )}

        {/* Video Container - 16:9 aspect ratio */}
        <div className="flex-1 sm:flex-none relative w-full sm:aspect-video">
          {/* Loading state */}
          {loadState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <Loader2 className="h-8 w-8 animate-spin text-white/60" />
            </div>
          )}
          
          {/* Error/Fallback state */}
          {loadState === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-4 p-6">
              <p className="text-white/80 text-center text-sm">
                Video couldn't load in the app.
              </p>
              <Button
                onClick={handleOpenYouTube}
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open on YouTube
              </Button>
            </div>
          )}
          
          {/* Mobile: fill available space, Desktop: 16:9 */}
          <div className="absolute inset-0 sm:relative sm:w-full sm:h-0 sm:pb-[56.25%]">
            <iframe
              ref={iframeRef}
              src={embedUrl}
              title={title || "Video"}
              allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
              allowFullScreen
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              className="absolute inset-0 w-full h-full sm:absolute sm:top-0 sm:left-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

VideoModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  youtubeId: PropTypes.string.isRequired,
  title: PropTypes.string,
};