"use client";

/**
 * PFaaS Platform — shared form validation feedback (audit finding #1).
 *
 * The three dashboards each rolled their own inline validation: the
 * platform admin did it well (destructive dialog), the prop admin
 * mostly omitted it, and the trader did it well but without the
 * progressive disclosure the other screens use. This module is the
 * single component library every form now shares:
 *
 *   • `FormField`     — labelled input with inline error + help text
 *   • `FormTextArea`  — same contract for multi-line inputs
 *   • `useFormValidation` — canonical timing: validate on blur, keep
 *     re-validating on change once a field has errored, validate
 *     everything on submit (audit U #8)
 *
 * Consistent visual styling everywhere:
 *   • `border-destructive` + `aria-invalid` while a field is invalid
 *   • error message in `role="alert"` linked via `aria-describedby`
 *   • optional character counter (progressive disclosure) that turns
 *     amber while under a minimum and hides once help text is no
 *     longer relevant
 *   • help text rendered only while the field is valid, so guidance
 *     never competes with the correction the user needs to read
 *
 * Accessibility contract (identical across all three apps):
 *   <label for=id> ↔ <input id=id> ↔ aria-describedby → error/help id
 */

import { useCallback, useState } from "react";
import { cn } from "@pfaas/ui/cn";

/* ------------------------------------------------------------------ */
/* Shared field chrome                                                 */
/* ------------------------------------------------------------------ */

interface FieldChromeProps {
  /** Unique ID — drives label, input and described-by references. */
  id: string;
  label: string;
  required?: boolean;
  /** Rendered at the end of the label row (e.g. a "Forgot?" link). */
  labelSuffix?: React.ReactNode;
  /** Live character count, e.g. `{ count: 12, max: 120 }`. */
  counter?: { count: number; max?: number; min?: number };
  error?: string;
  helpText?: string;
}

function FieldLabel({
  id,
  label,
  required,
  labelSuffix,
  counter,
}: FieldChromeProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="flex items-center gap-2">
        {counter ? (
          <span
            className={cn(
              "text-[10px] tabular-nums text-muted-foreground",
              counter.min !== undefined &&
                counter.count < counter.min &&
                "text-amber-600 dark:text-amber-400",
            )}
            aria-hidden="true"
          >
            {counter.count}
            {counter.max !== undefined ? ` / ${counter.max}` : ""}
          </span>
        ) : null}
        {labelSuffix}
      </div>
    </div>
  );
}

function FieldMessage({
  id,
  error,
  helpText,
}: {
  id: string;
  error?: string;
  helpText?: string;
}) {
  // Error wins: correction first, guidance second (progressive disclosure).
  if (error) {
    return (
      <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
        {error}
      </p>
    );
  }
  if (helpText) {
    return (
      <p id={`${id}-help`} className="text-[11px] text-muted-foreground">
        {helpText}
      </p>
    );
  }
  return null;
}

const inputClasses = (invalid: boolean) =>
  cn(
    "flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    invalid
      ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
      : "border-input",
  );

/* ------------------------------------------------------------------ */
/* FormField                                                           */
/* ------------------------------------------------------------------ */

export interface FormFieldProps extends FieldChromeProps {
  /** Input type (textarea is `FormTextArea`). */
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | "datetime-local";
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  maxLength?: number;
  /** Show the live character count (requires `maxLength` or `min`). */
  showCount?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  helpText,
  required,
  labelSuffix,
  placeholder,
  disabled,
  autoFocus,
  autoComplete,
  maxLength,
  showCount,
  counter: counterOverride,
  className,
  onKeyDown,
}: FormFieldProps) {
  const invalid = Boolean(error);
  const counter =
    counterOverride ??
    (showCount ? { count: value.length, max: maxLength } : undefined);

  return (
    <div className="space-y-1.5">
      <FieldLabel
        id={id}
        label={label}
        required={required}
        labelSuffix={labelSuffix}
        counter={counter}
      />
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={invalid ? `${id}-error` : helpText ? `${id}-help` : undefined}
        className={cn(inputClasses(invalid), className)}
      />
      <FieldMessage id={id} error={error} helpText={helpText} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FormTextArea                                                        */
/* ------------------------------------------------------------------ */

export interface FormTextAreaProps extends FieldChromeProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  className?: string;
}

export function FormTextArea({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  helpText,
  required,
  labelSuffix,
  placeholder,
  disabled,
  rows = 3,
  maxLength,
  showCount,
  counter: counterOverride,
  className,
}: FormTextAreaProps) {
  const invalid = Boolean(error);
  const counter =
    counterOverride ??
    (showCount ? { count: value.length, max: maxLength } : undefined);

  return (
    <div className="space-y-1.5">
      <FieldLabel
        id={id}
        label={label}
        required={required}
        labelSuffix={labelSuffix}
        counter={counter}
      />
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={invalid ? `${id}-error` : helpText ? `${id}-help` : undefined}
        className={cn(inputClasses(invalid), "min-h-[80px] resize-y", className)}
      />
      <FieldMessage id={id} error={error} helpText={helpText} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* useFormValidation                                                   */
/* ------------------------------------------------------------------ */

export type FieldValidators<T extends string> = Record<T, (value: string) => string>;

/**
 * Canonical validation timing shared by every dashboard (audit U #8):
 *
 *   1. blur   → validate and surface the message
 *   2. change → re-validate only once a field has already errored, so
 *               a half-typed value never flashes an error at the user
 *   3. submit → validate everything and block until clean
 *
 * `showError(field)` marks every field as touched (used on submit) so
 * errors registered by `validateAll` are visible even without a blur.
 */
export function useFormValidation<T extends string>(validators: FieldValidators<T>) {
  const [errors, setErrors] = useState<Partial<Record<T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<T, boolean>>>({});

  const validate = useCallback(
    (field: T, value: string) => validators[field](value),
    [validators],
  );

  const onBlur = useCallback(
    (field: T, value: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const message = validate(field, value);
      setErrors((prev) => ({ ...prev, [field]: message }));
    },
    [validate],
  );

  const onChange = useCallback(
    (field: T, value: string) => {
      // Only re-validate a field that has already been touched — the
      // same rule produces the same message as blur and submit.
      setErrors((prev) =>
        touched[field] ? { ...prev, [field]: validate(field, value) } : prev,
      );
    },
    [touched, validate],
  );

  /** Validate every field, mark all touched, return true when clean. */
  const validateAll = useCallback(
    (values: Partial<Record<T, string>>) => {
      const next: Partial<Record<T, string>> = {};
      let valid = true;
      (Object.keys(validators) as T[]).forEach((field) => {
        const message = validate(field, values[field] ?? "");
        next[field] = message;
        if (message) valid = false;
      });
      setErrors(next);
      setTouched(
        (Object.keys(validators) as T[]).reduce(
          (acc, field) => ({ ...acc, [field]: true }),
          {} as Partial<Record<T, boolean>>,
        ),
      );
      return valid;
    },
    [validate, validators],
  );

  const reset = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  /**
   * Props bundle for the matching `FormField` / `FormTextArea`.
   *
   * Pass the value setter as the third argument — the hook only owns
   * *validation* state, so the controlled input's value must be written
   * by the consumer or React resets every keystroke:
   *
   *   <FormField value={email} {...field("email", email, setEmail)} />
   */
  const field = (name: T, value: string, setValue?: (next: string) => void) => ({
    error: errors[name],
    onBlur: () => onBlur(name, value),
    onChange: (next: string) => {
      setValue?.(next);
      onChange(name, next);
    },
  });

  return { errors, touched, field, onBlur, onChange, validateAll, reset };
}
