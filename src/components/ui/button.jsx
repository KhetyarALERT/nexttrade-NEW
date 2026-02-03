// @ts-nocheck
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30",
        destructive:
          "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25 hover:bg-destructive/90",
        outline:
          "border-2 border-input bg-transparent hover:bg-accent hover:text-accent-foreground hover:border-primary/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600",
        gradient:
          "bg-gradient-to-r from-primary to-blue-400 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:brightness-110",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * @typedef {import("react").ComponentPropsWithoutRef<"button">} NativeButtonProps
 */

/**
 * @typedef {NativeButtonProps & {
 *  variant?: keyof typeof buttonVariants.variants.variant,
 *  size?: keyof typeof buttonVariants.variants.size,
 *  asChild?: boolean,
 * }} ButtonProps
 */

// Import haptic utility with patterns
import { triggerHaptic } from "@/components/mobile/haptics";

/**
 * @type {import("react").ForwardRefRenderFunction<HTMLButtonElement, ButtonProps>}
 */
function ButtonInner({ className, variant, size, asChild = false, onClick, hapticType, type, ...props }, ref) {
  const Comp = asChild ? Slot : "button";
  
  const handleClick = (e) => {
    // Determine haptic pattern:
    // 1. Explicit hapticType prop takes precedence
    // 2. Form submit buttons (type="submit") use heavy haptic
    // 3. Variant-based defaults
    // 4. Default to light
    const haptic = hapticType ? hapticType :
                   type === "submit" ? "heavy" :
                   variant === "destructive" ? "warning" : 
                   variant === "success" ? "success" : 
                   "light";
    triggerHaptic(haptic);
    onClick?.(e);
  };
  
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      onClick={handleClick}
      type={type}
      {...props}
    />
  );
}

const Button = React.forwardRef(ButtonInner)
Button.displayName = "Button"

export { Button, buttonVariants }