// @ts-nocheck
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

/**
 * @typedef {import("react").ElementRef<typeof TabsPrimitive.List>} TabsListRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof TabsPrimitive.List>} TabsListProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<TabsListRef, TabsListProps>}
 */
function TabsListInner({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-xl bg-muted/50 p-1 text-muted-foreground gap-1",
        className
      )}
      {...props}
    />
  );
}

const TabsList = React.forwardRef(TabsListInner)
TabsList.displayName = TabsPrimitive.List.displayName

/**
 * @typedef {import("react").ElementRef<typeof TabsPrimitive.Trigger>} TabsTriggerRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>} TabsTriggerProps
 */

// Haptic feedback utility
const triggerHaptic = () => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10);
  }
};

/**
 * @type {import("react").ForwardRefRenderFunction<TabsTriggerRef, TabsTriggerProps>}
 */
function TabsTriggerInner({ className, onClick, ...props }, ref) {
  const handleClick = (e) => {
    triggerHaptic();
    onClick?.(e);
  };
  
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md hover:text-foreground/80 active:scale-[0.97]",
        className
      )}
      onClick={handleClick}
      {...props}
    />
  );
}

const TabsTrigger = React.forwardRef(TabsTriggerInner)
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

/**
 * @typedef {import("react").ElementRef<typeof TabsPrimitive.Content>} TabsContentRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof TabsPrimitive.Content>} TabsContentProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<TabsContentRef, TabsContentProps>}
 */
function TabsContentInner({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  );
}

const TabsContent = React.forwardRef(TabsContentInner)
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }