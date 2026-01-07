import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80",
        outline: "text-foreground border-border/50",
        success:
          "border-transparent bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20",
        warning:
          "border-transparent bg-amber-500/10 text-amber-500 dark:bg-amber-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * @typedef {import("react").ComponentPropsWithoutRef<"div"> & import("class-variance-authority").VariantProps<typeof badgeVariants>} BadgeProps
 */

/** @param {BadgeProps} props */
function Badge({ className, variant = "default", ...props }) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
