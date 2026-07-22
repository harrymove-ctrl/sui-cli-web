"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ShimmerSkeletonProps
  extends React.HTMLAttributes<HTMLDivElement> {
  animate?: boolean;
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
}

export function ShimmerSkeleton({
  className,
  animate = true,
  rounded = "md",
  ...props
}: ShimmerSkeletonProps) {
  return (
    <div
      className={cn(
        "bg-muted",
        {
          "rounded-none": rounded === "none",
          "rounded-sm": rounded === "sm",
          "rounded-md": rounded === "md",
          "rounded-lg": rounded === "lg",
          "rounded-xl": rounded === "xl",
          "rounded-2xl": rounded === "2xl",
          "rounded-3xl": rounded === "3xl",
          "rounded-full": rounded === "full",
        },
        animate && "animate-shimmer bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.4)_20%,rgba(255,255,255,0.7)_50%,rgba(255,255,255,0.4)_80%,transparent)] dark:bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.15)_20%,rgba(255,255,255,0.4)_50%,rgba(255,255,255,0.15)_80%,transparent)] bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}
