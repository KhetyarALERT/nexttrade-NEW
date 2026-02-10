import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, RefreshCw, Sparkles, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Premium Message Bubble
const AdminMessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      "flex gap-3 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
        isUser 
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" 
          : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/20"
      )}>
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </div>
      
      {/* Bubble */}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed",
        isUser 
          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tr-sm" 
          : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-tl-sm"
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        
        {/* Tool Status */}
        {message.tool_calls?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            {message.tool_calls.map((call, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-2 py-1.5 font-mono">
                <span className="text-muted-foreground">Exec:</span>
                <span className="font-medium text-foreground">{call.name}</span>
                <span className="flex-1" />
                {call.status === 'success' ? (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Success
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Error
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function AdminAssistant() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  // Initialize
  useEffect(() => {
    let mounted = true;
    const initChat = async () => {
      try {
        const existing = await base44.agents.listConversations({ agent_name: "admin_assistant" });
        const list = Array.isArray(existing) ? existing : (existing.data || []);
        let activeConv = list[0];
        
        if (!activeConv) {
          const res = await base44.agents.createConversation({
            agent_name: "admin_assistant",
            metadata: { name: "Admin Session" }
          });
          activeConv = res.data || res;
        }
        
        if (mounted) {
          const validId = activeConv?.id || activeConv?._id;
          if (validId) {
            setConversation({ ...activeConv, id: validId });
            setMessages(activeConv.messages || []);
          } else {
            console.error("Invalid conversation format:", activeConv);
            setError("Failed to initialize chat session");
          }
        }
      } catch (err) {
        console.error("Failed to init admin chat:", err);
        if (mounted) setError("Could not connect to Admin Agent");
      }
    };
    initChat();
    return () => { mounted = false; };
  }, []);

  // Subscribe
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
      const scroll = scrollRef.current;
      scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async (e, contentOverride = null) => {
    e?.preventDefault();
    const content = contentOverride || input;
    
    if (!content.trim()) return;
    
    if (!conversation?.id) {
      setError("Connection lost. Refreshing...");
      // Try to re-init
      try {
        const existing = await base44.agents.listConversations({ agent_name: "admin_assistant" });
        const list = Array.isArray(existing) ? existing : (existing.data || []);
        let activeConv = list[0];
        
        if (!activeConv) {
          const res = await base44.agents.createConversation({
            agent_name: "admin_assistant",
            metadata: { name: "Admin Session" }
          });
          activeConv = res.data || res;
        }
        
        const validId = activeConv?.id || activeConv?._id; // Handle potential ID field variations
        if (validId) {
          const validConv = { ...activeConv, id: validId };
          setConversation(validConv);
          // Retry send with new conversation
          await base44.agents.addMessage(validId, {
            role: "user",
            content
          });
          setInput("");
          setError(null);
          return;
        } else {
          console.error("Invalid conversation object from create:", activeConv);
          throw new Error("Could not restore session - Missing ID");
        }
      } catch (err) {
        console.error("Re-init failed:", err);
        setError("Chat disconnected. Please refresh the page.");
        return;
      }
    }

    setInput("");
    setError(null);
    
    try {
      await base44.agents.addMessage(conversation.id, {
        role: "user",
        content
      });
    } catch (err) {
      console.error("Failed to send:", err);
      // Check if error is due to invalid ID (404/500)
      if (err.message?.includes("Invalid id") || err.message?.includes("Object not found")) {
         setConversation(null); // Force re-init next time
         setError("Session expired. Please try again.");
      } else {
         setError("Failed to send message. Try again.");
      }
      setInput(content); // Restore input
    }
  };

  const handleClear = async () => {
    if (!conversation) return;
    setMessages([]);
    // Optionally archive conversation logic here
    toast.success("Chat history cleared");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-xl border-r border-border shadow-2xl relative z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 bg-background/80 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight">Admin Assistant</h3>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-medium text-muted-foreground/80">Online</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50" onClick={handleClear} title="Clear Chat">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50" onClick={() => navigate(createPageUrl("Dashboard"))} title="Exit Admin">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden relative bg-gradient-to-b from-transparent to-white/5 dark:to-black/5">
        <ScrollArea className="h-full px-4 pt-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 opacity-70">
              <div className="h-20 w-20 rounded-3xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-6 animate-pulse">
                <Bot className="h-10 w-10 text-indigo-500" />
              </div>
              <h4 className="font-semibold text-lg mb-2">Welcome Back, Admin</h4>
              <p className="text-sm text-muted-foreground mb-8 max-w-[260px] leading-relaxed">
                I can help verify users, analyze trading data, or manage system configuration.
              </p>
              
              <div className="grid gap-2.5 w-full max-w-[280px]">
                {[
                  "Show pending verifications", 
                  "Check platform balance", 
                  "Analyze copy trading stats"
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(null, q)}
                    className="text-xs font-medium py-2.5 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-md hover:shadow-indigo-500/5 transition-all text-left flex items-center group"
                  >
                    <span className="flex-1">{q}</span>
                    <Send className="h-3 w-3 text-muted-foreground group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-6">
              {messages.map((m, i) => (
                <AdminMessageBubble key={i} message={m} />
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 mb-4 animate-pulse ml-1">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Thinking...</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-600 text-xs mb-4 border border-red-500/20">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-4 bg-background border-t border-border/50 shrink-0">
        <form onSubmit={handleSend} className="relative group">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI Assistant..."
            className="pr-12 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-background focus:ring-2 focus:ring-indigo-500/20 transition-all rounded-xl shadow-sm text-sm"
            disabled={!conversation || isTyping}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:shadow-none"
            disabled={!input.trim() || !conversation || isTyping}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}