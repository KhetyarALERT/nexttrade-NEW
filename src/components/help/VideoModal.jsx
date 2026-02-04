import { useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { X } from "lucide-react";
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

  if (!open) return null;

  const embedUrl = `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=1`;

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
          {/* Mobile: fill available space, Desktop: 16:9 */}
          <div className="absolute inset-0 sm:relative sm:w-full sm:h-0 sm:pb-[56.25%]">
            <iframe
              src={embedUrl}
              title={title || "Video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
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