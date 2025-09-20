import React from "react";
import { cn } from "@/lib/utils";

interface PulsatingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pulseColor?: string;
  duration?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function PulsatingButton({
  className,
  children,
  pulseColor = "#0096ff",
  duration = "1.5s",
  ...props
}: PulsatingButtonProps) {
  // Remove custom props from being passed to DOM
  const { pulseColor: _, duration: __, ...buttonProps } = props as any;

  return (
    <button
      className={cn(
        "relative text-center cursor-pointer",
        className,
      )}
      {...buttonProps}
    >
      <div className="relative z-10">{children}</div>

      {/* Pulsating ring effect */}
      <div
        className="absolute top-1/2 left-1/2 w-full h-full rounded-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse-custom"
        style={{
          background: `radial-gradient(circle, ${pulseColor}40 0%, ${pulseColor}20 50%, transparent 70%)`,
          animationDuration: duration,
        }}
      />

      {/* Outer pulse ring */}
      <div
        className="absolute top-1/2 left-1/2 w-[110%] h-[110%] rounded-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none border-2 opacity-60 animate-ping-custom"
        style={{
          borderColor: pulseColor,
          animationDuration: duration,
        }}
      />
    </button>
  );
}