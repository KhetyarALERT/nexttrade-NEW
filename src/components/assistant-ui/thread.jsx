import React from "react";
import { Paperclip, SendHorizontal } from "lucide-react";

import { InvokeLLM } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { tAssistant } from "@/lib/i18n/assistant";
import { cn } from "@/lib/utils";

const seedCards = (t) => [
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

function extractAssistantText(response) {
  if (!response) return "";
  if (typeof response === "string") return response;
  return (
    response.message ||
    response.content ||
    response.output ||
    response.text ||
    response.result ||
    response?.choices?.[0]?.message?.content ||
    response?.choices?.[0]?.text ||
    ""
  );
}

function parseAssistantPayload(text) {
  if (!text) return { message: "", cards: [] };
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return {
        message: parsed.message || parsed.text || "",
        cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      };
    }
  } catch {
    // ignore JSON parse issues
  }
  return { message: text, cards: [] };
}

export function Thread({ language = "en", isRtl = false }) {
  const t = React.useMemo(() => tAssistant(language), [language]);
  const [cards, setCards] = React.useState(() => seedCards(t));
  const [messages, setMessages] = React.useState(() => initialMessages(t));
  const [composerValue, setComposerValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [attachments, setAttachments] = React.useState([]);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    setCards(seedCards(t));
    setMessages(initialMessages(t));
  }, [t]);

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
    const files = Array.from(event.dataTransfer.files || []).map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      name: file.name,
      type: file.type,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    if (!files.length) return;
    setAttachments((prev) => [...prev, ...files]);
  };

  const onAttachClick = () => {
    fileInputRef.current?.click();
  };

  const onAttachChange = (event) => {
    const files = Array.from(event.target.files || []).map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      name: file.name,
      type: file.type,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    if (!files.length) return;
    setAttachments((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  React.useEffect(() => {
    return () => {
      attachments.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [attachments]);

  const handleSend = async () => {
    const trimmed = composerValue.trim();
    if (!trimmed && attachments.length === 0) return;

    const attachmentSummary = attachments.length
      ? `\n\n${t.attachmentsTitle}:\n${attachments.map((file) => `- ${file.name}`).join("\n")}`
      : "";
    const userContent = `${trimmed}${attachmentSummary}`;
    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed || t.attachmentsTitle,
      attachments,
    };

    setMessages((prev) => [...prev, userMessage]);
    setComposerValue("");
    setAttachments([]);
    setIsLoading(true);

    const systemPrompt = t.systemPrompt;
    const history = [...messages, userMessage]
      .filter((msg) => msg.role && msg.content)
      .map((msg) => ({ role: msg.role, content: msg.content }));

    try {
      const response = await InvokeLLM({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: userContent },
        ],
      });

      const rawText = extractAssistantText(response);
      const payload = parseAssistantPayload(rawText);
      const resolvedCards = Array.isArray(response?.cards) ? response.cards : payload.cards;
      const assistantMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: payload.message || rawText || t.fallbackMessage,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (resolvedCards.length) {
        const newCards = resolvedCards.map((card, index) => ({
          id: `${assistantMessage.id}-card-${index}`,
          title: card.title || t.cardTitle,
          description: card.description || "",
          bullets: card.bullets || [],
          actions: card.actions || [],
        }));
        setCards((prev) => [...prev, ...newCards]);
        setMessages((prev) => [
          ...prev,
          ...newCards.map((card) => ({
            id: `${assistantMessage.id}-card-message-${card.id}`,
            role: "assistant",
            type: "card",
            cardId: card.id,
          })),
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-error`, role: "assistant", content: t.errorMessage },
      ]);
      // eslint-disable-next-line no-console
      console.error("Assistant error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
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
                <div className="max-w-[80%] space-y-2">
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2 text-sm shadow-sm",
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {message.content}
                  </div>
                  {message.attachments?.length ? (
                    <div className={cn("flex flex-wrap gap-2", isUser && !isRtl && "justify-end")}>
                      {message.attachments.map((file) => (
                        <span
                          key={file.id}
                          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted px-3 py-1 text-xs text-muted-foreground"
                        >
                          {file.previewUrl ? (
                            <img
                              src={file.previewUrl}
                              alt={file.name}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : null}
                          {file.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {isLoading ? (
            <div className={cn("flex", isRtl ? "justify-end" : "justify-start")}>
              <div className="rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                {t.thinking}
              </div>
            </div>
          ) : null}
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
              {attachments.map((file) => (
                <span
                  key={file.id}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted px-3 py-1 text-xs text-muted-foreground"
                >
                  {file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt={file.name}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : null}
                  {file.name}
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
              value={composerValue}
              onChange={(event) => setComposerValue(event.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isRtl && "text-right"
              )}
              disabled={isLoading}
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="default"
            aria-label={t.sendLabel}
            onClick={handleSend}
            disabled={isLoading}
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
