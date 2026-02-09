import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "rounded-2xl border text-card-foreground transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-border/60 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-card-hover",
        glass: "border-border/40 bg-card/60 backdrop-blur-xl shadow-lg hover:shadow-xl",
        solid: "border-border/70 bg-card shadow-sm hover:shadow-md",
        gradient: "border-border/50 bg-gradient-to-br from-primary/10 via-card/80 to-cyan-500/10 shadow-lg hover:shadow-xl",
        stat: "border-border/60 bg-card/70 shadow-stat hover:-translate-y-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * @typedef {import("react").ElementRef<"div">} DivRef
 * @typedef {import("react").ComponentPropsWithoutRef<"div">} DivProps
 */

/**
 * @typedef {DivProps & {
 *  variant?: "default" | "glass" | "solid" | "gradient" | "stat",
 * }} CardProps
 */

/** @type {import("react").ForwardRefRenderFunction<DivRef, CardProps>} */
function CardInner({ className, variant, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, className }))}
      {...props}
    />
  )
}

const Card = React.forwardRef(CardInner)
Card.displayName = "Card"

/** @type {import("react").ForwardRefRenderFunction<DivRef, DivProps>} */
function CardHeaderInner({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-2 p-6", className)}
      {...props}
    />
  )
}

const CardHeader = React.forwardRef(CardHeaderInner)
CardHeader.displayName = "CardHeader"

/** @type {import("react").ForwardRefRenderFunction<DivRef, DivProps>} */
function CardTitleInner({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

const CardTitle = React.forwardRef(CardTitleInner)
CardTitle.displayName = "CardTitle"

/** @type {import("react").ForwardRefRenderFunction<DivRef, DivProps>} */
function CardDescriptionInner({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

const CardDescription = React.forwardRef(CardDescriptionInner)
CardDescription.displayName = "CardDescription"

/** @type {import("react").ForwardRefRenderFunction<DivRef, DivProps>} */
function CardContentInner({ className, ...props }, ref) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
}

const CardContent = React.forwardRef(CardContentInner)
CardContent.displayName = "CardContent"

/** @type {import("react").ForwardRefRenderFunction<DivRef, DivProps>} */
function CardFooterInner({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
}

const CardFooter = React.forwardRef(CardFooterInner)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
