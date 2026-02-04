import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Clock, Paperclip, SendHorizontal, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { tAssistant } from "@/components/i18n/translations";
import { cn } from "@/lib/utils";
import QuickActions from "./QuickActions";
import SuggestionChips, { getSuggestionsForConversation } from "./SuggestionChips";
import VideoModal from "@/components/help/VideoModal";

const AGENT_NAME = "supportAssistant";

/**
 * Chat states for message pipeline
 */
const CHAT_STATE = {
  IDLE: "idle",
  SENDING_USER: "sending_user",
  ASSISTANT_TYPING: "assistant_typing",
  ASSISTANT_DONE: "assistant_done",
};

/**
 * Check if content is empty/whitespace only
 */
function isEmptyContent(content) {
  if (!content) return true;
  if (typeof content !== "string") return true;
  return content.trim().length === 0;
}

/**
 * Deduplicate messages by id, keeping latest version
 */
function deduplicateMessages(messages) {
  const seen = new Map();
  for (const msg of messages) {
    if (msg.id) {
      seen.set(msg.id, msg);
    }
  }
  return Array.from(seen.values());
}

/**
 * Filter out empty assistant messages
 */
function filterValidMessages(messages) {
  return messages.filter((msg) => {
    // Always keep user messages
    if (msg.role === "user") return true;
    // For assistant messages, only keep if content is non-empty
    if (msg.role === "assistant") {
      return !isEmptyContent(msg.content);
    }
    return true;
  });
}

export function Thread({ language = "en", isRtl = false }) {
  const navigate = useNavigate();
  const t = useMemo(() => tAssistant(language), [language]);
  
  // Core state
  const [messages, setMessages] = useState([]);
  const [composerValue, setComposerValue] = useState("");
  const [chatState, setChatState] = useState(CHAT_STATE.IDLE);
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [videoModal, setVideoModal] = useState({ open: false, youtubeId: null, title: "" });
  const [streamingContent, setStreamingContent] = useState("");
  
  // Refs
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const conversationRef = useRef(null);

  const isLoading = chatState === CHAT_STATE.SENDING_USER || chatState === CHAT_STATE.ASSISTANT_TYPING;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isLoading]);

  // Initialize conversation
  useEffect(() => {
    let mounted = true;
    
    const initConversation = async () => {
      try {
        const conversation = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: { name: "Support Chat", language }
        });
        if (mounted) {
          setConversationId(conversation.id);
          conversationRef.current = conversation;
        }
      } catch (err) {
        console.error("[CHAT] Failed to create conversation:", err.message);
      }
    };
    
    initConversation();
    return () => { mounted = false; };
  }, [language]);

  // Subscribe to real-time conversation updates (streaming)
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      if (!data?.messages?.length) return;

      const agentMessages = data.messages;
      const lastMsg = agentMessages[agentMessages.length - 1];
      
      // Check if assistant is still generating (streaming)
      const isStreaming = lastMsg?.role === "assistant" && 
                          (lastMsg?.status === "in_progress" || lastMsg?.status === "streaming");
      
      if (isStreaming) {
        // Update streaming content for real-time display
        setStreamingContent(lastMsg.content || "");
        setChatState(CHAT_STATE.ASSISTANT_TYPING);
      } else {
        // Message complete - clear streaming and update messages
        setStreamingContent("");
        
        // Map and filter messages
        const mappedMessages = agentMessages.map((msg, idx) => ({
          id: msg.id || `agent-${idx}-${msg.created_at}`,
          role: msg.role,
          content: msg.content,
          time: msg.created_at || new Date().toISOString(),
          tool_calls: msg.tool_calls,
          status: msg.status,
        }));
        
        // Filter out empty assistant messages and deduplicate
        const validMessages = filterValidMessages(deduplicateMessages(mappedMessages));
        
        // Only update if we have new valid messages
        if (validMessages.length > 0) {
          setMessages(validMessages);
          lastMessageCountRef.current = validMessages.length;
          
          // Check if last message is a complete assistant reply
          const finalMsg = validMessages[validMessages.length - 1];
          if (finalMsg?.role === "assistant" && !isEmptyContent(finalMsg.content)) {
            setChatState(CHAT_STATE.ASSISTANT_DONE);
            setShowQuickActions(false);
          }
        }
      }
    });

    return () => unsubscribe?.();
  }, [conversationId]);

  // Format time helper
  const formatTime = useCallback((value) => {
    if (!value) return "";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleTimeString(language === "ar" ? "ar-SA" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [language]);

  // Drag & drop handlers
  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []).map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      name: file.name,
      type: file.type,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    if (files.length) setAttachments((prev) => [...prev, ...files]);
  };

  const onAttachClick = () => fileInputRef.current?.click();
  const onAttachChange = (e) => {
    const files = Array.from(e.target.files || []).map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      name: file.name,
      type: file.type,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    if (files.length) setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  // Cleanup attachment URLs
  useEffect(() => {
    return () => {
      attachments.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [attachments]);

  // Handle quick action selection
  const handleQuickAction = async (actionKey, label) => {
    setShowQuickActions(false);
    const query = language === "ar" ? `أريد مساعدة في: ${label}` : `I need help with: ${label}`;
    await sendMessage(query);
  };

  // Handle suggestion chip selection
  const handleSuggestionSelect = async (key, label) => {
    const query = language === "ar" ? label : label;
    await sendMessage(query);
  };

  const handleSuggestionRoute = (route) => {
    navigate(route);
  };

  const handleSuggestionVideo = (youtubeId, title) => {
    setVideoModal({ open: true, youtubeId, title });
  };

  // Core send message function
  const sendMessage = async (content) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setChatState(CHAT_STATE.SENDING_USER);
    setShowQuickActions(false);
    setComposerValue("");

    // Optimistically add user message
    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      time: new Date().toISOString(),
      attachments: [...attachments],
    };
    setMessages((prev) => [...prev, userMessage]);
    setAttachments([]);

    try {
      setChatState(CHAT_STATE.ASSISTANT_TYPING);
      
      // Get fresh conversation reference
      let conversation = conversationRef.current;
      if (!conversation && conversationId) {
        conversation = await base44.agents.getConversation(conversationId);
        conversationRef.current = conversation;
      }

      if (conversation) {
        // Send to agent - the subscription will handle the response
        await base44.agents.addMessage(conversation, {
          role: "user",
          content: trimmed,
        });
        // State will be updated by subscription callback
      } else {
        throw new Error("No conversation available");
      }
    } catch (err) {
      console.error("[CHAT] Send error:", err);
      setChatState(CHAT_STATE.IDLE);
      
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: t.errorMessage,
          time: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleSend = () => {
    const trimmed = composerValue.trim();
    if (!trimmed && attachments.length === 0) return;
    sendMessage(trimmed || t.attachmentsTitle);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get contextual suggestions based on conversation
  const suggestions = useMemo(() => {
    if (messages.length === 0) return [];
    if (chatState === CHAT_STATE.ASSISTANT_TYPING) return [];
    
    // Only show after assistant reply
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role !== "assistant") return [];
    
    return getSuggestionsForConversation(messages, window.location.pathname);
  }, [messages, chatState]);

  // Empty state text
  const emptyStateText = language === "ar" 
    ? "كيف أقدر أساعدك؟ اختر من الخيارات أو اكتب سؤالك."
    : "How can I help? Choose an option or type your question.";

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden bg-background",
        isDragging && "ring-2 ring-primary/30"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Messages Area */}
      <div className="relative flex-1 overflow-y-auto px-4 py-5">
        <div className={cn("space-y-4", isRtl && "text-right")}>
          
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className={cn(
              "text-center py-8 text-muted-foreground text-sm",
              isRtl && "text-right"
            )}>
              {emptyStateText}
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => {
            const isUser = message.role === "user";
            
            // Skip empty assistant messages (extra safety)
            if (!isUser && isEmptyContent(message.content)) return null;

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
                <div className="max-w-[85%] space-y-1.5">
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm",
                      isUser 
                        ? "bg-foreground text-background" 
                        : "bg-card border border-border/50 text-foreground"
                    )}
                  >
                    {isUser ? (
                      message.content
                    ) : (
                      <ReactMarkdown
                        className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5"
                        components={{
                          a: ({ children, ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {children}
                            </a>
                          ),
                          code: ({ children }) => (
                            <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{children}</code>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  
                  {/* Attachments */}
                  {message.attachments?.length > 0 && (
                    <div className={cn("flex flex-wrap gap-2", isUser && !isRtl && "justify-end")}>
                      {message.attachments.map((file) => (
                        <span
                          key={file.id}
                          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted px-3 py-1 text-xs text-muted-foreground"
                        >
                          {file.previewUrl && (
                            <img src={file.previewUrl} alt={file.name} className="h-5 w-5 rounded-full object-cover" />
                          )}
                          {file.name}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Timestamp */}
                  <div className={cn(
                    "flex items-center gap-1 text-[10px] text-muted-foreground",
                    isUser && !isRtl && "justify-end",
                    isRtl && !isUser && "justify-end"
                  )}>
                    <Clock className="h-2.5 w-2.5" />
                    {formatTime(message.time)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Streaming/Typing indicator */}
          {chatState === CHAT_STATE.ASSISTANT_TYPING && (
            <div className={cn("flex", isRtl ? "justify-end" : "justify-start")}>
              <div className="max-w-[85%] space-y-1.5">
                <div className="rounded-2xl bg-card border border-border/50 px-4 py-2.5 text-sm text-foreground">
                  {streamingContent ? (
                    <ReactMarkdown
                      className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                    >
                      {streamingContent}
                    </ReactMarkdown>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t.thinking}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contextual suggestions after assistant reply */}
          {suggestions.length > 0 && chatState !== CHAT_STATE.ASSISTANT_TYPING && (
            <div className={cn("pt-2", isRtl ? "text-right" : "text-left")}>
              <SuggestionChips
                suggestions={suggestions}
                language={language}
                onSelect={handleSuggestionSelect}
                onRoute={handleSuggestionRoute}
                onVideo={handleSuggestionVideo}
                disabled={isLoading}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Drag overlay */}
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-background/80 text-sm font-medium text-muted-foreground">
            {t.dropHint}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border/70 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {/* Quick Actions - only when empty */}
        {showQuickActions && messages.length === 0 && (
          <QuickActions
            language={language}
            onSelect={handleQuickAction}
            disabled={isLoading}
          />
        )}

        {/* Attachments preview */}
        {attachments.length > 0 && (
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
                  {file.previewUrl && (
                    <img src={file.previewUrl} alt={file.name} className="h-5 w-5 rounded-full object-cover" />
                  )}
                  {file.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Composer */}
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
              onChange={(e) => setComposerValue(e.target.value)}
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
            className="h-11 w-11"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Video Modal */}
      {videoModal.open && (
        <VideoModal
          open={videoModal.open}
          onClose={() => setVideoModal({ open: false, youtubeId: null, title: "" })}
          youtubeId={videoModal.youtubeId}
          title={videoModal.title}
        />
      )}
    </div>
  );
}