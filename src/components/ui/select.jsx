// @ts-nocheck

"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"

// Hook to detect mobile viewport (<768px)
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  
  return isMobile;
}

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

/**
 * @typedef {import("react").ElementRef<typeof SelectPrimitive.Trigger>} SelectTriggerRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>} SelectTriggerProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<SelectTriggerRef, SelectTriggerProps>}
 */
function SelectTriggerInner({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-11 w-full items-center justify-between whitespace-nowrap rounded-xl border-2 border-input bg-background/50 px-4 py-2 text-sm shadow-sm ring-offset-background transition-all duration-200 data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 hover:border-border/80",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

const SelectTrigger = React.forwardRef(SelectTriggerInner)
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

/**
 * @typedef {import("react").ElementRef<typeof SelectPrimitive.ScrollUpButton>} SelectScrollUpRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>} SelectScrollUpProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<SelectScrollUpRef, SelectScrollUpProps>}
 */
function SelectScrollUpButtonInner({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

const SelectScrollUpButton = React.forwardRef(SelectScrollUpButtonInner)
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

/**
 * @typedef {import("react").ElementRef<typeof SelectPrimitive.ScrollDownButton>} SelectScrollDownRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>} SelectScrollDownProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<SelectScrollDownRef, SelectScrollDownProps>}
 */
function SelectScrollDownButtonInner({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

const SelectScrollDownButton = React.forwardRef(SelectScrollDownButtonInner)
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

/**
 * @typedef {import("react").ElementRef<typeof SelectPrimitive.Content>} SelectContentRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof SelectPrimitive.Content>} SelectContentProps
 */



/**
 * Mobile drawer content - renders as bottom sheet
 */
function SelectContentMobile({ className, children, ...props }, ref) {
  const { open, setOpen } = React.useContext(SelectOpenContext);
  
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="max-h-[60vh]">
        <VisuallyHidden.Root>
          <DrawerTitle>Select an option</DrawerTitle>
        </VisuallyHidden.Root>
        <div className="overflow-y-auto p-2 pb-8">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

const SelectContentMobileRef = React.forwardRef(SelectContentMobile);

/**
 * Responsive SelectContent - uses Drawer on mobile, Popover on desktop
 * @type {import("react").ForwardRefRenderFunction<SelectContentRef, SelectContentProps>}
 */
function SelectContentInner({ className, children, position = "popper", ...props }, ref) {
  const isMobile = useIsMobile();
  
  // On mobile, use drawer-based selection
  if (isMobile) {
    return (
      <SelectContentMobileRef ref={ref} className={className} {...props}>
        {children}
      </SelectContentMobileRef>
    );
  }
  
  // On desktop, use standard popover
  return (
    <SelectContentDesktopRef ref={ref} className={className} position={position} {...props}>
      {children}
    </SelectContentDesktopRef>
  );
}

const SelectContent = React.forwardRef(SelectContentInner)
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props} />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

/**
 * @typedef {import("react").ElementRef<typeof SelectPrimitive.Item>} SelectItemRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof SelectPrimitive.Item>} SelectItemProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<SelectItemRef, SelectItemProps>}
 */
function SelectItemInner({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

const SelectItem = React.forwardRef(SelectItemInner)
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props} />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}