import { X } from "lucide-react";
import { AssistantModalPrimitive } from "@/lib/assistant-ui/react";

import { Thread } from "@/components/assistant-ui/thread";
import { tAssistant } from "@/lib/i18n/assistant";
import { cn } from "@/lib/utils";
// @ts-ignore - Vite resolves asset imports at runtime; checkJs may not have module typings for .png
import nextTradeLogo from "@/assets/nexttrade-logo.png";

export function AssistantModal({ language = "en" }) {
  const t = tAssistant(language);
  const isRtl = language === "ar";

  return (
    <AssistantModalPrimitive.Root>
      <AssistantModalPrimitive.Anchor className="bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 sm:right-6 sm:bottom-6 max-sm:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <AssistantModalPrimitive.Trigger asChild>
          <button
            type="button"
            className={cn(
              "relative flex h-14 w-14 items-center justify-center rounded-full",
              "border border-border/70 bg-background",
              "shadow-lg shadow-black/10 transition duration-200",
              "hover:scale-[1.04] hover:shadow-xl hover:shadow-black/15",
              "active:scale-[0.98]"
            )}
            aria-label={t.support}
          >
            <span className="absolute inset-0 rounded-full bg-white/10 blur-md" />
            <img src={nextTradeLogo} alt="NextTrade" className="relative h-8 w-8 object-contain" />
          </button>
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>

      <AssistantModalPrimitive.Content
        sideOffset={16}
        className={cn(
          "right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))]",
          "flex h-[min(85vh,640px)] w-[min(420px,calc(100vw-2rem))] flex-col",
          "rounded-2xl border border-border/70 bg-popover shadow-2xl shadow-black/20",
          "data-[state=open]:translate-y-0 data-[state=closed]:translate-y-2",
          "data-[state=open]:duration-200 data-[state=closed]:duration-150",
          "max-sm:left-4 max-sm:right-4 max-sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]",
          "max-sm:h-[85vh]"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border/70 px-4 py-3",
            isRtl && "flex-row-reverse"
          )}
        >
          <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse text-right")}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background">
              <img src={nextTradeLogo} alt="NextTrade" className="h-5 w-5 object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{t.support}</div>
              <div className="text-xs text-emerald-500">{t.online}</div>
            </div>
          </div>
          <AssistantModalPrimitive.Close asChild>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted text-muted-foreground transition hover:text-foreground"
              aria-label={t.closeLabel}
            >
              <X className="h-4 w-4" />
            </button>
          </AssistantModalPrimitive.Close>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-4">
          <Thread language={language} isRtl={isRtl} />
        </div>
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
}
