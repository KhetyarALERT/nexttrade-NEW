import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

/** @typedef {import('react').ElementRef<typeof AccordionPrimitive.Item>} AccordionItemElement */
/** @typedef {import('react').ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>} AccordionItemProps */
/** @type {import('react').ForwardRefExoticComponent<AccordionItemProps & import('react').RefAttributes<AccordionItemElement>>} */
const AccordionItem = React.forwardRef((props, ref) => {
  const { className, ...rest } = props;
  return <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...rest} />;
})
AccordionItem.displayName = "AccordionItem"

/** @typedef {import('react').ElementRef<typeof AccordionPrimitive.Trigger>} AccordionTriggerElement */
/** @typedef {import('react').ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>} AccordionTriggerProps */
/** @type {import('react').ForwardRefExoticComponent<AccordionTriggerProps & import('react').RefAttributes<AccordionTriggerElement>>} */
const AccordionTrigger = React.forwardRef((props, ref) => {
  const { className, children, ...rest } = props;
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          "flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline text-left [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...rest}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
})
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

/** @typedef {import('react').ElementRef<typeof AccordionPrimitive.Content>} AccordionContentElement */
/** @typedef {import('react').ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>} AccordionContentProps */
/** @type {import('react').ForwardRefExoticComponent<AccordionContentProps & import('react').RefAttributes<AccordionContentElement>>} */
const AccordionContent = React.forwardRef((props, ref) => {
  const { className, children, ...rest } = props;
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...rest}
    >
      <div className={cn("pb-4 pt-0", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
})
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
