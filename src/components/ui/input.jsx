import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * @typedef {import("react").ComponentPropsWithoutRef<"input">} InputProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<HTMLInputElement, InputProps>}
 */
function InputInner({ className, type, ...props }, ref) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border-2 border-input bg-background/50 px-4 py-2 text-base shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-border/80",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}

const Input = React.forwardRef(InputInner)
Input.displayName = "Input"

export { Input }
