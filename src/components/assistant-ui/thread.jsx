import React from "react";
import { Check, Clock, Image as ImageIcon, Paperclip, Rocket, SendHorizontal, X } from "lucide-react";

import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { tAssistant } from "@/lib/i18n/assistant";
import { cn } from "@/lib/utils";

const AGENT_NAME = "supportAssistant";

function CardMessage({ card }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.5)]">
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

function ApprovalCardMessage({ approval }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.55)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">{approval.title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{approval.description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90"
        >
          <Check className="h-4 w-4" />
          {approval.confirmLabel}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
          {approval.cancelLabel}
        </button>
      </div>
    </div>
  );
}

function ImageCardMessage({ image, formatFileSize, formatTime }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_20px_45px_-36px_rgba(15,23,42,0.55)]">
      <div className="relative">
        <img src={image.src} alt={image.alt} className="h-48 w-full object-cover" />
        <div className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow">
          {image.ratio}
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            {image.domain}
          </div>
          <div className="text-[11px] text-muted-foreground">{formatFileSize(image.fileSizeBytes)}</div>
        </div>
        <div className="text-sm font-semibold text-foreground">{image.title}</div>
        <p className="text-xs leading-relaxed text-muted-foreground">{image.description}</p>
        <div className="flex items-center justify-between border-t border-border/70 pt-2">
          <div className="flex items-center gap-2">
            <img
              src={image.source.iconUrl}
              alt={image.source.label}
              className="h-6 w-6 rounded-full border border-border/60"
            />
            <div>
              <div className="text-xs font-semibold text-foreground">{image.source.label}</div>
              <div className="text-[11px] text-muted-foreground">{formatTime(image.createdAt)}</div>
            </div>
          </div>
          <a
            href={image.source.url}
            className="text-xs font-semibold text-foreground hover:opacity-80"
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>
        </div>
      </div>
    </div>
  );
}

export function Thread({ language = "en", isRtl = false }) {
  const t = React.useMemo(() => tAssistant(language), [language]);
  const cards = React.useMemo(() => [], []);
  const [messages, setMessages] = React.useState([]);
  const [composerValue, setComposerValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [attachments, setAttachments] = React.useState([]);
  const [conversationId, setConversationId] = React.useState(null);
  const fileInputRef = React.useRef(null);
  
  // Initialize conversation with agent
  React.useEffect(() => {
    const initConversation = async () => {
      try {
        const conversation = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: { name: "Support Chat", language }
        });
        setConversationId(conversation.id);
      } catch (err) {
        console.log("[CHAT] Failed to create conversation:", err.message);
      }
    };
    initConversation();
  }, [language]);
  
  // Subscribe to conversation updates
  React.useEffect(() => {
    if (!conversationId) return;
    
    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      if (data?.messages?.length) {
        // Map agent messages to our format
        const agentMessages = data.messages.map((msg, idx) => ({
          id: msg.id || `agent-${idx}`,
          role: msg.role,
          content: msg.content,
          time: msg.created_at || new Date().toISOString(),
          tool_calls: msg.tool_calls
        }));
        setMessages(agentMessages);
      }
    });
    
    return () => unsubscribe?.();
  }, [conversationId]);

  React.useEffect(() => {
    setMessages([]);
  }, [t]);

  const formatTime = React.useCallback(
    (value) => {
      if (!value) return "";
      const normalized = typeof value === "string" ? value.trim() : value;
      if (typeof normalized === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
        return normalized;
      }
      const date = typeof normalized === "string" ? new Date(normalized) : normalized;
      if (!date || Number.isNaN(date.getTime?.())) return "";
      return date.toISOString().replace(/\.\d{3}Z$/, "");
    },
    []
  );

  const formatFileSize = React.useCallback((bytes = 0) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }, []);

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

    const time = new Date().toISOString();
    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed || t.attachmentsTitle,
      attachments,
      time,
    };

    setMessages((prev) => [...prev, userMessage]);
    setComposerValue("");
    setAttachments([]);
    setIsLoading(true);

    try {
      // Use the Base44 agent SDK if we have a conversation
      if (conversationId) {
        const conversation = await base44.agents.getConversation(conversationId);
        await base44.agents.addMessage(conversation, {
          role: "user",
          content: trimmed || t.attachmentsTitle
        });
        // The subscription will handle updating messages
      } else {
        // Fallback to direct LLM if no conversation
        const { InvokeLLM } = await import("@/api/integrations");
        const systemPrompt = t.systemPrompt;
        const history = [...messages, userMessage]
          .filter((msg) => msg.role && msg.content)
          .map((msg) => ({ role: msg.role, content: msg.content }));

        const response = await InvokeLLM({
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: trimmed },
          ],
        });

        const rawText = extractAssistantText(response);
        const payload = parseAssistantPayload(rawText);
        const assistantMessage = {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: payload.message || rawText || t.fallbackMessage,
          time: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error("[CHAT] Send error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content: t.errorMessage,
          time: new Date().toISOString(),
        },
      ]);
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
        "flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20",
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
              return (
                <div key={message.id} className="space-y-1">
                  <CardMessage card={card} />
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(message.time || message.createdAt)}
                  </div>
                </div>
              );
            }

            if (message.type === "approval") {
              return (
                <div key={message.id} className="space-y-1">
                  <ApprovalCardMessage approval={message.approval} />
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(message.time || message.createdAt)}
                  </div>
                </div>
              );
            }

            if (message.type === "image") {
              return (
                <div key={message.id} className="space-y-1">
                  <ImageCardMessage
                    image={message.image}
                    formatFileSize={formatFileSize}
                    formatTime={formatTime}
                  />
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(message.time || message.createdAt)}
                  </div>
                </div>
              );
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
                      "rounded-2xl px-4 py-2 text-sm shadow-[0_14px_30px_-24px_rgba(15,23,42,0.45)]",
                      isUser ? "bg-foreground text-background" : "bg-card text-foreground"
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
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(message.time || message.createdAt)}
                  </div>
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

        <div className={cn("flex items-end gap-2", isRtl && "flex-row-reverse")}>
          <button
            type="button"
            onClick={onAttachClick}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-muted text-muted-foreground transition hover:text-foreground"
            aria-label={t.attachLabel}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onAttachChange} />
          <div className="flex-1">
            <label className="sr-only" htmlFor="assistant-composer">
              {t.composerPlaceholder}
            </label>
            <textarea
              id="assistant-composer"
              value={composerValue}
              onChange={(event) => setComposerValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.composerPlaceholder}
              className={cn(
                "min-h-[52px] w-full resize-none rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isRtl && "text-right"
              )}
              rows={1}
              disabled={isLoading}
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="default"
            aria-label={t.sendLabel}
            onClick={handleSend}
            disabled={isLoading || (!composerValue.trim() && attachments.length === 0)}
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
