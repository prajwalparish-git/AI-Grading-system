'use client'

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string
  variant?: "default" | "success" | "warning" | "destructive" | "purple"
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorClassName, variant = "default", ...props }, ref) => {
  const variantColor = {
    default: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]",
    success: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    warning: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
    destructive: "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]",
    purple: "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]",
  }[variant]

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all duration-500 ease-in-out",
          variantColor,
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
