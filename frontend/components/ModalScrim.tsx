"use client";

import type { ReactNode } from "react";

type Props = {
  onDismiss: () => void;
  /** Full Tailwind classes for the overlay (position, z-index, flex, padding, scrim color, blur, scroll). */
  className: string;
  children: ReactNode;
};

/**
 * Full-viewport overlay. Calls onDismiss when the user presses the dimmed scrim
 * (the overlay itself), not when interacting with children (e.g. the dialog panel).
 */
export function ModalScrim({ onDismiss, className, children }: Props) {
  return (
    <div
      role="presentation"
      className={className}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      {children}
    </div>
  );
}
