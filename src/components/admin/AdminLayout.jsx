import AdminAssistant from "@/components/admin/AdminAssistant";

export default function AdminLayout({ children }) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden" dir="ltr">
      {/* Left Panel - AI Admin Assistant - Always on Left due to dir="ltr" */}
      <aside className="w-[380px] h-full border-r border-border bg-card/30 hidden md:flex flex-col shrink-0 relative z-20">
        <AdminAssistant />
      </aside>

      {/* Right Panel - Workspace */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative bg-background">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ 
               backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
               backgroundSize: '24px 24px' 
             }} 
        />
        
        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}