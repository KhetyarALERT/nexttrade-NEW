import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, RefreshCw, Sparkles, Loader2, StopCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// Message Bubble Component (Internal)
const AdminMessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
        isUser 
          ? "bg-primary text-primary-foreground rounded-tr-none" 
          : "bg-card border border-border rounded-tl-none"
      )}>
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        
        {/* Tool Calls Display */}
        {message.tool_calls?.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.tool_calls.map((call, i) => (
              <div key={i} className="text-xs bg-black/5 dark:bg-white/5 rounded p-2 font-mono border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-muted-foreground">Running:</span>
                  <span className="font-semibold text-primary">{call.name}</span>
                </div>
                {call.status === 'success' && (
                  <span className="text-green-500 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    Completed
                  </span>
                )}
                {call.status === 'error' && (
                  <span className="text-red-500 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                    Failed
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border border-border shrink-0">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

export default function AdminAssistant() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Initialize or fetch conversation
  useEffect(() => {
    const initChat = async () => {
      try {
        // List existing to see if we can resume, or create new
        const existing = await base44.agents.listConversations({ agent_name: "admin_assistant" });
        let activeConv = existing.data?.[0];
        
        if (!activeConv) {
          activeConv = await base44.agents.createConversation({
            agent_name: "admin_assistant",
            metadata: { name: "Admin Session" }
          });
        }
        
        setConversation(activeConv);
        setMessages(activeConv.messages || []);
      } catch (err) {
        console.error("Failed to init admin chat:", err);
      }
    };
    initChat();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!conversation?.id) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages);
      setIsTyping(data.status === 'processing' || data.status === 'generating');
    });

    return () => unsubscribe();
  }, [conversation?.id]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || !conversation) return;

    const content = input;
    setInput("");
    
    try {
      await base44.agents.addMessage(conversation.id, {
        role: "user",
        content
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Admin AI</h3>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[10px] text-muted-foreground">Active & Ready</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setMessages([])}>
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full px-4 pt-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">How can I help?</h4>
              <p className="text-sm text-muted-foreground max-w-[240px]">
                I can check verification queues, analyze staking rewards, or lookup user details for you.
              </p>
              
              <div className="mt-6 grid gap-2 w-full max-w-[260px]">
                {["Pending Verifications?", "Check Pool Balance", "Show failed withdrawals"].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); handleSend(); }}
                    className="text-xs py-2 px-3 rounded-lg bg-card border border-border/60 hover:bg-accent/50 hover:border-primary/30 transition-all text-left truncate"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {messages.map((m, i) => (
                <AdminMessageBubble key={i} message={m} />
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground ml-12 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI is analyzing...
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-4 bg-background border-t border-border/50 shrink-0">
        <form onSubmit={handleSend} className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about users, stats, or actions..."
            className="pr-12 h-11 bg-muted/30 border-border/60 focus:bg-background transition-all"
            disabled={!conversation}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-1 top-1 h-9 w-9 rounded-lg"
            disabled={!input.trim() || !conversation}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-2 flex justify-center">
          <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            AI can make mistakes. Verify critical actions.
          </p>
        </div>
      </div>
    </div>
  );
}