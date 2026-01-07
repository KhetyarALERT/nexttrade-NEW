import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
 *   className?: string
 * }} SliderProps
 */

/** @type {React.ForwardRefRenderFunction<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>} */
const SliderInner = ({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}>
    <SliderPrimitive.Track
      className="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/20">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-primary to-blue-400" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-lg shadow-primary/20 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:scale-110 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 cursor-grab active:cursor-grabbing" />
  </SliderPrimitive.Root>
)

const Slider = React.forwardRef(SliderInner)
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
