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
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
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

/**
 * @type {import("react").ForwardRefRenderFunction<TabsTriggerRef, TabsTriggerProps>}
 */
function TabsTriggerInner({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        className
      )}
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
