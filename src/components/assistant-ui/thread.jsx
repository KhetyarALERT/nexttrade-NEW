import React from "react";
import { Paperclip, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { tAssistant } from "@/lib/i18n/assistant";
import { cn } from "@/lib/utils";

const sampleCards = (t) => [
  {
    id: "market",
    title: t.cardTitle,
    description: t.cardDescription,
    bullets: [t.cardBulletOne, t.cardBulletTwo, t.cardBulletThree],
    actions: [
      { id: "dashboard", label: t.cardActionPrimary, variant: "default" },
      { id: "alert", label: t.cardActionSecondary, variant: "outline" },
    ],
  },
];

const initialMessages = (t) => [
  { id: "welcome", role: "assistant", content: t.welcome },
  { id: "card", role: "assistant", type: "card", cardId: "market" },
  { id: "question", role: "user", content: t.sampleQuestion },
];

function CardMessage({ card }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="text-sm font-semibold text-foreground">{card.title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {card.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {card.actions.map((action) => (
          <Button key={action.id} type="button" size="sm" variant={action.variant}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function Thread({ language = "en", isRtl = false }) {
  const t = React.useMemo(() => tAssistant(language), [language]);
  const cards = React.useMemo(() => sampleCards(t), [t]);
  const messages = React.useMemo(() => initialMessages(t), [t]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [attachments, setAttachments] = React.useState([]);
  const fileInputRef = React.useRef(null);

  const onDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (event) => {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsDragging(false);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (!files.length) return;
    setAttachments((prev) => [...prev, ...files.map((file) => file.name)]);
  };

  const onAttachClick = () => {
    fileInputRef.current?.click();
  };

  const onAttachChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setAttachments((prev) => [...prev, ...files.map((file) => file.name)]);
    event.target.value = "";
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-popover",
        isDragging && "border-primary/70 ring-2 ring-primary/30"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="relative flex-1 overflow-y-auto px-4 py-5">
        <div className={cn("space-y-4", isRtl && "text-right")}>
          {messages.map((message) => {
            if (message.type === "card") {
              const card = cards.find((item) => item.id === message.cardId);
              if (!card) return null;
              return <CardMessage key={message.id} card={card} />;
            }

            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  isUser ? "justify-end" : "justify-start",
                  isRtl && isUser ? "justify-start" : "",
                  isRtl && !isUser ? "justify-end" : ""
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {message.content}
                </div>
              </div>
            );
          })}
        </div>
        {isDragging ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-background/80 text-sm font-medium text-muted-foreground">
            {t.dropHint}
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/70 bg-background/80 px-4 py-3">
        {attachments.length ? (
          <div className="mb-3">
            <div className={cn("text-xs font-semibold text-muted-foreground", isRtl && "text-right")}>
              {t.attachmentsTitle}
            </div>
            <div className={cn("mt-2 flex flex-wrap gap-2", isRtl && "justify-end")}>
              {attachments.map((name, index) => (
                <span
                  key={`${name}-${index}`}
                  className="inline-flex items-center rounded-full border border-border/70 bg-muted px-3 py-1 text-xs text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
          <button
            type="button"
            onClick={onAttachClick}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-muted text-muted-foreground transition hover:text-foreground"
            aria-label={t.attachLabel}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onAttachChange}
          />
          <div className="flex-1">
            <label className="sr-only" htmlFor="assistant-composer">
              {t.composerPlaceholder}
            </label>
            <input
              id="assistant-composer"
              type="text"
              placeholder={t.composerPlaceholder}
              className={cn(
                "h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isRtl && "text-right"
              )}
            />
          </div>
          <Button type="button" size="icon" variant="default" aria-label={t.sendLabel}>
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
