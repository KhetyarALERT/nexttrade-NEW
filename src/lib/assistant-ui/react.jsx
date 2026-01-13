import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<"div"> & React.RefAttributes<HTMLDivElement>>} */
const Anchor = React.forwardRef(function Anchor({ className, ...props }, ref) {
  return <div ref={ref} className={cn("fixed right-4 bottom-4 z-50", className)} {...props} />;
});

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof Dialog.Content> & { sideOffset?: number } & React.RefAttributes<HTMLDivElement>>} */
const Content = React.forwardRef(function Content({ className, sideOffset: _sideOffset, children, ...props }, ref) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          "fixed inset-0 z-40 bg-black/25 backdrop-blur-sm",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        )}
      />
      <Dialog.Content
        ref={ref}
        className={cn(
          "fixed z-50 outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        )}
        {...props}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
});

export const AssistantModalPrimitive = {
  Root: Dialog.Root,
  Trigger: Dialog.Trigger,
  Close: Dialog.Close,
  Anchor,
  Content,
};
