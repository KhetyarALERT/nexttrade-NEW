"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

/**
 * @typedef {import("react").ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
 *   value?: number | null,
 * }} ProgressProps
 */

/**
 * @type {import("react").ForwardRefRenderFunction<import("react").ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>}
 */
function ProgressInner({ className, value, ...props }, ref) {
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-primary/15",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-gradient-to-r from-primary to-blue-400 transition-all duration-300"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

const Progress = React.forwardRef(ProgressInner)
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
