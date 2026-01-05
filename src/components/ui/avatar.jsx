"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

/**
 * @typedef {import("react").ElementRef<typeof AvatarPrimitive.Root>} AvatarRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>} AvatarProps
 */

/** @type {import("react").ForwardRefRenderFunction<AvatarRef, AvatarProps>} */
function AvatarInner({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

const Avatar = React.forwardRef(AvatarInner)
Avatar.displayName = AvatarPrimitive.Root.displayName

/**
 * @typedef {import("react").ElementRef<typeof AvatarPrimitive.Image>} AvatarImageRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>} AvatarImageProps
 */

/** @type {import("react").ForwardRefRenderFunction<AvatarImageRef, AvatarImageProps>} */
function AvatarImageInner({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn("aspect-square h-full w-full", className)}
      {...props}
    />
  )
}

const AvatarImage = React.forwardRef(AvatarImageInner)
AvatarImage.displayName = AvatarPrimitive.Image.displayName

/**
 * @typedef {import("react").ElementRef<typeof AvatarPrimitive.Fallback>} AvatarFallbackRef
 * @typedef {import("react").ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>} AvatarFallbackProps
 */

/** @type {import("react").ForwardRefRenderFunction<AvatarFallbackRef, AvatarFallbackProps>} */
function AvatarFallbackInner({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted",
        className
      )}
      {...props}
    />
  )
}

const AvatarFallback = React.forwardRef(AvatarFallbackInner)
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
