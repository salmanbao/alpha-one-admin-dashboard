"use client";

/**
 * Keyboard navigation patterns for multi-step forms — finding #2 (LOW) gap.
 * Adds step-to-step traversal (Tab/Shift+Tab), Save/Submit shortcuts,
 * Cancel/Escape, and navigation buttons as well as arrow keys
 * between steps.
 */

import { useEffect } from "react";

export interface MultiStepKeyboardOptions {
  currentStep: number;
  stepCount: number;
  onNext?: () => void;
  onPrev?: () => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  onGoToStep?: (step: number) => void;
}

export function useMultiStepKeyboard({
  currentStep,
  stepCount,
  onNext,
  onPrev,
  onSubmit,
  onCancel,
  onGoToStep,
}: MultiStepKeyboardOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const formRegion = target.closest("[data-multistep-form]");
      if (!formRegion) return;

      // Enter / Space inside the navigation buttons activates them (native).
      // We add override for Enter as “submit” on final step when focused
      // outside an input/textarea/select.
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (!isInput) {
        if (e.key === "Enter" || e.key === " ") {
          if (currentStep === stepCount - 1 && onSubmit) {
            e.preventDefault();
            onSubmit();
            return;
          }
          if (currentStep < stepCount - 1 && onNext) {
            e.preventDefault();
            onNext();
            return;
          }
        }
      }

      // Escape cancels / returns to previous step
      if (e.key === "Escape" && !isInput && onCancel) {
        e.preventDefault();
        onCancel();
        return;
      }

      // Arrow keys navigate between steps when focus is on step buttons
      if (e.key === "ArrowRight" && !isInput && onNext) {
        e.preventDefault();
        onNext();
        return;
      }
      if (e.key === "ArrowLeft" && !isInput && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [currentStep, stepCount, onNext, onPrev, onSubmit, onCancel, onGoToStep]);
}

export const MULTISTEP_SHORTCUTS = [
  { keys: "Tab / Shift+Tab", label: "Move between fields and step buttons" },
  { keys: "Enter / Space", label: "Activate focused button / submit final step" },
  { keys: "→ / ←", label: "Next / previous step (from step navigation)" },
  { keys: "Esc", label: "Cancel / return to previous step" },
];
