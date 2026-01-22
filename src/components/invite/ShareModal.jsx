import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { X, Copy, Check, MessageCircle, Send, Share2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// X (Twitter) icon
const XIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

XIcon.propTypes = { className: PropTypes.string };

const PRESETS = {
  en: {
    short: {
      label: "Short",
      message: "Join NextTrade and trade smarter. Sign up with my link:"
    },
    detailed: {
      label: "Detailed",
      message: "Use my link to register on NextTrade. Complete verification and start trading crypto futures:"
    },
    catchy: {
      label: "Catchy",
      message: "I'm using NextTrade — fast, clean, and pro. Get started here:"
    }
  },
  ar: {
    short: {
      label: "قصير",
      message: "سجّل على NextTrade من رابط الدعوة تبعي:"
    },
    detailed: {
      label: "واضح",
      message: "سجّل من الرابط، كمّل التحقق، وابدأ تداول:"
    },
    catchy: {
      label: "حماسي",
      message: "جرّب NextTrade — تجربة تداول مرتبة وسريعة. هذا رابط الدعوة:"
    }
  }
};

const t = {
  en: {
    title: "Share Your Link",
    presets: "Message Style",
    editMessage: "Edit message",
    preview: "Preview",
    shareVia: "Share via",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    twitter: "X (Twitter)",
    copyMessage: "Copy Message",
    copyLink: "Copy Link",
    systemShare: "More Options",
    copied: "Copied!",
    close: "Close"
  },
  ar: {
    title: "شارك رابطك",
    presets: "نوع الرسالة",
    editMessage: "عدّل الرسالة",
    preview: "معاينة",
    shareVia: "شارك عبر",
    whatsapp: "واتساب",
    telegram: "تيليجرام",
    twitter: "X (تويتر)",
    copyMessage: "نسخ الرسالة",
    copyLink: "نسخ الرابط",
    systemShare: "خيارات أخرى",
    copied: "تم النسخ!",
    close: "إغلاق"
  }
};

export default function ShareModal({ isOpen, onClose, link, language = "en" }) {
  const isAr = language === "ar";
  const txt = t[language] || t.en;
  const presets = PRESETS[language] || PRESETS.en;

  const [selectedPreset, setSelectedPreset] = useState("short");
  const [customMessage, setCustomMessage] = useState("");
  const [copiedType, setCopiedType] = useState(null);

  // Initialize message when modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomMessage(presets[selectedPreset].message);
      setCopiedType(null);
    }
  }, [isOpen, selectedPreset, presets]);

  // Update message when preset changes
  useEffect(() => {
    setCustomMessage(presets[selectedPreset].message);
  }, [selectedPreset, presets]);

  if (!isOpen) return null;

  const fullMessage = `${customMessage} ${link}`;

  const handleCopy = async (type) => {
    const textToCopy = type === "link" ? link : fullMessage;
    await navigator.clipboard.writeText(textToCopy);
    setCopiedType(type);
    toast.success(txt.copied);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleShare = (platform) => {
    const encodedMessage = encodeURIComponent(fullMessage);
    const encodedLink = encodeURIComponent(link);
    const encodedText = encodeURIComponent(customMessage);

    switch (platform) {
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
        break;
      case "telegram":
        window.open(`https://t.me/share/url?url=${encodedLink}&text=${encodedText}`, "_blank");
        break;
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encodedMessage}`, "_blank");
        break;
      case "native":
        if (navigator.share) {
          navigator.share({ title: "NextTrade", text: customMessage, url: link }).catch(() => {});
        } else {
          handleCopy("message");
        }
        break;
      default:
        break;
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Bottom sheet on mobile, centered on desktop */}
      <div 
        className="fixed z-50 inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full"
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
          {/* Handle bar (mobile) */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{txt.title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Preset Selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{txt.presets}</p>
              <div className="flex gap-2">
                {Object.entries(presets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPreset(key)}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                      selectedPreset === key
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Message */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{txt.editMessage}</p>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full h-20 px-4 py-3 rounded-xl bg-muted border-0 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                dir={isAr ? "rtl" : "ltr"}
              />
            </div>

            {/* Preview */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{txt.preview}</p>
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-sm text-foreground leading-relaxed" dir={isAr ? "rtl" : "ltr"}>
                  {customMessage}{" "}
                  <span className="text-primary font-mono text-xs break-all" dir="ltr">
                    {link}
                  </span>
                </p>
              </div>
            </div>

            {/* Share Buttons Grid */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">{txt.shareVia}</p>
              <div className="grid grid-cols-3 gap-3">
                {/* WhatsApp */}
                <button
                  onClick={() => handleShare("whatsapp")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{txt.whatsapp}</span>
                </button>

                {/* Telegram */}
                <button
                  onClick={() => handleShare("telegram")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Send className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{txt.telegram}</span>
                </button>

                {/* X (Twitter) */}
                <button
                  onClick={() => handleShare("twitter")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-foreground flex items-center justify-center group-hover:scale-105 transition-transform">
                    <XIcon className="w-5 h-5 text-background" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{txt.twitter}</span>
                </button>
              </div>
            </div>

            {/* Copy & System Share */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleCopy("message")}
                className="h-12 rounded-xl gap-2"
              >
                {copiedType === "message" ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span className="text-sm">{copiedType === "message" ? txt.copied : txt.copyMessage}</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => handleCopy("link")}
                className="h-12 rounded-xl gap-2"
              >
                {copiedType === "link" ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                <span className="text-sm">{copiedType === "link" ? txt.copied : txt.copyLink}</span>
              </Button>
            </div>

            {/* System Share (if available) */}
            {typeof navigator !== "undefined" && navigator.share && (
              <Button
                onClick={() => handleShare("native")}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground gap-2"
              >
                <Share2 className="w-4 h-4" />
                {txt.systemShare}
              </Button>
            )}
          </div>

          {/* Safe area padding for mobile */}
          <div className="h-6 sm:h-4" />
        </div>
      </div>
    </>
  );
}

ShareModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  link: PropTypes.string.isRequired,
  language: PropTypes.string
};