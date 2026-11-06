"use client";

/**
 * M1 — Shared dynamic config form (spec §5.2, §5.3).
 *
 * The configuration drawer and the add-connector wizard render the same
 * schema-driven controls from a connector definition's `fields`, so every
 * connector gets identical anatomy with provider-specific inputs.
 *
 * Client validation (required / JSON / URL / number range) runs before
 * Save (drawer) or Continue (wizard); errors render inline in red under
 * each control and Save/Continue stay blocked until they clear.
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { Eye, EyeOff } from "lucide-react";
import type { ConfigField, ConnectorDefinition } from "./types";

/** Field-key → inline error message. Empty object = valid. */
export type FieldErrors = Record<string, string>;

/**
 * Validate form values against a definition's config schema.
 * Mirrors the store-side JSON check (saveConnectorConfig) so the drawer
 * and wizard block bad input before it reaches the store.
 */
export function validateConfig(
  def: ConnectorDefinition | undefined,
  values: Record<string, string>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of def?.fields ?? []) {
    const value = (values[field.key] ?? "").trim();
    if (field.required && !value) {
      errors[field.key] = "This field is required.";
      continue;
    }
    if (!value) continue;
    if (field.json) {
      try {
        JSON.parse(value);
      } catch {
        errors[field.key] = "Must be valid JSON.";
      }
      continue;
    }
    if (field.type === "url" && !/^https?:\/\/\S+/i.test(value)) {
      errors[field.key] = "Must start with http:// or https://.";
      continue;
    }
    if (field.type === "number") {
      const n = Number(value);
      if (Number.isNaN(n)) {
        errors[field.key] = "Must be a number.";
      } else if (field.min !== undefined && n < field.min) {
        errors[field.key] = `Must be at least ${field.min}.`;
      } else if (field.max !== undefined && n > field.max) {
        errors[field.key] = `Must be at most ${field.max}.`;
      }
    }
  }
  return errors;
}

/** One schema field → labeled control with inline error. */
export function ConfigFieldControl({
  field,
  value,
  error,
  onChange,
  idPrefix = "cfg",
}: {
  field: ConfigField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  idPrefix?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const id = `${idPrefix}-${field.key}`;
  const label = (
    <Label htmlFor={id} className="text-xs font-medium">
      {field.help ? (
        <LabelWithHelp help={field.help}>{field.label}</LabelWithHelp>
      ) : (
        <>
          {field.label}
          {field.required ? (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </>
      )}
    </Label>
  );

  return (
    <div className="space-y-1.5">
      {label}
      {field.type === "select" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full" aria-invalid={!!error}>
            <SelectValue placeholder={field.placeholder ?? "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.secret ? (
        <div className="flex gap-1.5">
          <Input
            id={id}
            type={revealed ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="font-mono text-xs"
            aria-invalid={!!error}
            autoComplete="off"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? `Hide ${field.label}` : `Show ${field.label}`}
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
          inputMode={field.type === "number" ? "numeric" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="font-mono text-xs"
          aria-invalid={!!error}
          autoComplete="off"
        />
      )}
      {error ? (
        <p role="alert" className="text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
