import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * @typedef {import("react").ElementRef<"div">} DivRef
 * @typedef {import("react").ComponentPropsWithoutRef<"div">} DivProps
 */

/** @type {import("react").ForwardRefRenderFunction<DivRef, DivProps>} */
function CardInner({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
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
      className={cn("flex flex-col space-y-1.5 p-6", className)}
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
      className={cn("font-semibold leading-none tracking-tight", className)}
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
