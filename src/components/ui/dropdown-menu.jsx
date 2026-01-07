// @ts-nocheck
import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

/**
 * @typedef {import("react").ElementRef<typeof DropdownMenuPrimitive.SubTrigger>} DropdownMenuSubTriggerRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }} DropdownMenuSubTriggerProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<DropdownMenuSubTriggerRef, DropdownMenuSubTriggerProps>}
 */
function DropdownMenuSubTriggerInner({ className, inset, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        "flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

const DropdownMenuSubTrigger = React.forwardRef(DropdownMenuSubTriggerInner)
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

/**
 * @typedef {import("react").ElementRef<typeof DropdownMenuPrimitive.SubContent>} DropdownMenuSubContentRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>} DropdownMenuSubContentProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<DropdownMenuSubContentRef, DropdownMenuSubContentProps>}
 */
function DropdownMenuSubContentInner({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  );
}

const DropdownMenuSubContent = React.forwardRef(DropdownMenuSubContentInner)
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

/**
 * @typedef {import("react").ElementRef<typeof DropdownMenuPrimitive.Content>} DropdownMenuContentRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & { sideOffset?: number }} DropdownMenuContentProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<DropdownMenuContentRef, DropdownMenuContentProps>}
 */
function DropdownMenuContentInner({ className, sideOffset = 4, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl p-1.5 text-popover-foreground shadow-xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

const DropdownMenuContent = React.forwardRef(DropdownMenuContentInner)
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

/**
 * @typedef {import("react").ElementRef<typeof DropdownMenuPrimitive.Item>} DropdownMenuItemRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }} DropdownMenuItemProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<DropdownMenuItemRef, DropdownMenuItemProps>}
 */
function DropdownMenuItemInner({ className, inset, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

const DropdownMenuItem = React.forwardRef(DropdownMenuItemInner)
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

/**
 * @typedef {import("react").ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>} DropdownMenuCheckboxItemRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>} DropdownMenuCheckboxItemProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<DropdownMenuCheckboxItemRef, DropdownMenuCheckboxItemProps>}
 */
function DropdownMenuCheckboxItemInner({ className, children, checked, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      checked={checked}
      {...props}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

const DropdownMenuCheckboxItem = React.forwardRef(DropdownMenuCheckboxItemInner)
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

/**
 * @typedef {import("react").ElementRef<typeof DropdownMenuPrimitive.RadioItem>} DropdownMenuRadioItemRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>} DropdownMenuRadioItemProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<DropdownMenuRadioItemRef, DropdownMenuRadioItemProps>}
 */
function DropdownMenuRadioItemInner({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="h-2 w-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

const DropdownMenuRadioItem = React.forwardRef(DropdownMenuRadioItemInner)
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

/**
 * @typedef {import("react").ElementRef<typeof DropdownMenuPrimitive.Label>} DropdownMenuLabelRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }} DropdownMenuLabelProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<DropdownMenuLabelRef, DropdownMenuLabelProps>}
 */
function DropdownMenuLabelInner({ className, inset, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
      {...props}
    />
  )
}

const DropdownMenuLabel = React.forwardRef(DropdownMenuLabelInner)
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

/**
 * @typedef {import("react").ElementRef<typeof DropdownMenuPrimitive.Separator>} DropdownMenuSeparatorRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>} DropdownMenuSeparatorProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<DropdownMenuSeparatorRef, DropdownMenuSeparatorProps>}
 */
function DropdownMenuSeparatorInner({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props}
    />
  )
}

const DropdownMenuSeparator = React.forwardRef(DropdownMenuSeparatorInner)
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}) => {
  return (
    (<span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props} />)
  );
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
