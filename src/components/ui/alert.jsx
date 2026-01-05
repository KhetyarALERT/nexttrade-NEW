import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * @typedef {import("react").ElementRef<"div">} AlertRef
 * @typedef {import("react").ComponentPropsWithoutRef<"div"> & import("class-variance-authority").VariantProps<typeof alertVariants>} AlertProps
 */

/** @type {import("react").ForwardRefRenderFunction<AlertRef, AlertProps>} */
function AlertInner({ className, variant, ...props }, ref) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

const Alert = React.forwardRef(AlertInner)
Alert.displayName = "Alert"

/**
 * @typedef {import("react").ElementRef<"h5">} AlertTitleRef
 * @typedef {import("react").ComponentPropsWithoutRef<"h5">} AlertTitleProps
 */

/** @type {import("react").ForwardRefRenderFunction<AlertTitleRef, AlertTitleProps>} */
function AlertTitleInner({ className, ...props }, ref) {
  return (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
}

const AlertTitle = React.forwardRef(AlertTitleInner)
AlertTitle.displayName = "AlertTitle"

/**
 * @typedef {import("react").ElementRef<"div">} AlertDescriptionRef
 * @typedef {import("react").ComponentPropsWithoutRef<"div">} AlertDescriptionProps
 */

/** @type {import("react").ForwardRefRenderFunction<AlertDescriptionRef, AlertDescriptionProps>} */
function AlertDescriptionInner({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
}

const AlertDescription = React.forwardRef(AlertDescriptionInner)
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
