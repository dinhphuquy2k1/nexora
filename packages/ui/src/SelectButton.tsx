"use client";

import type { ReactNode, ChangeEvent } from "react";
import { Button, Checkbox } from "./Controls";
import styles from "./SelectButton.module.css";

export interface SelectButtonOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Computes the next selected value in single-selection segmented mode.
 * - Clicking the already selected option when `allowEmpty` is true unselects it (returns null).
 * - Clicking the already selected option when `allowEmpty` is false maintains current selection.
 * - Clicking a different option selects that option.
 */
export function nextSingleSelection<T extends string>(
  current: T | null,
  clicked: T,
  allowEmpty: boolean = false,
): T | null {
  if (current === clicked) {
    return allowEmpty ? null : current;
  }
  return clicked;
}

/**
 * Computes the next array of selected values in multiple-selection stacked mode.
 * - Checking an option adds it if not already present.
 * - Unchecking an option removes it if present.
 * - Preserves immutability.
 */
export function nextMultipleSelection<T extends string>(
  current: readonly T[],
  value: T,
  checked: boolean,
): T[] {
  if (checked) {
    return current.includes(value) ? [...current] : [...current, value];
  }
  return current.filter((v) => v !== value);
}

interface BaseSelectButtonProps<T extends string> {
  options: readonly SelectButtonOption<T>[];
  ariaLabel: string;
  className?: string;
  fluid?: boolean;
  disabled?: boolean;
  renderOption?: (
    option: SelectButtonOption<T>,
    state: { selected: boolean },
  ) => ReactNode;
}

export type SingleSegmentedSelectButtonProps<T extends string> =
  BaseSelectButtonProps<T> & {
    mode: "single";
    layout: "segmented";
    value: T | null;
    appearance?: "default" | "text-actions";
    allowEmpty?: boolean;
    onValueChange: (value: T | null) => void;
  };

export type MultipleStackedSelectButtonProps<T extends string> =
  BaseSelectButtonProps<T> & {
    mode: "multiple";
    layout: "stacked";
    value: readonly T[];
    appearance?: never;
    onValueChange: (value: T[]) => void;
  };

export type SelectButtonProps<T extends string> =
  | SingleSegmentedSelectButtonProps<T>
  | MultipleStackedSelectButtonProps<T>;

export function SelectButton<T extends string>(props: SelectButtonProps<T>) {
  if (props.mode === "single" && props.layout === "segmented") {
    const {
      options,
      value,
      ariaLabel,
      className = "",
      fluid = false,
      disabled = false,
      allowEmpty = false,
      appearance = "default",
      onValueChange,
      renderOption,
    } = props;

    const isTextActions = appearance === "text-actions";

    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={`${styles.segmented} ${isTextActions ? styles.textActions : ""} ${fluid ? styles.fluid : ""} ${className}`.trim()}
      >
        {options.flatMap((option, idx) => {
          const selected = value === option.value;
          const isOptionDisabled = disabled || Boolean(option.disabled);

          const elements: ReactNode[] = [];
          if (isTextActions && idx > 0) {
            elements.push(
              <span
                key={`sep-${option.value}`}
                className={styles.textActionsSeparator}
                aria-hidden="true"
              >
                |
              </span>,
            );
          }
          elements.push(
            <Button
              key={option.value}
              variant="secondary"
              aria-pressed={selected}
              disabled={isOptionDisabled}
              className={`${styles.segmentedItem} ${selected ? styles.selected : ""}`.trim()}
              onClick={() => {
                if (isOptionDisabled) return;
                const next = nextSingleSelection(
                  value,
                  option.value,
                  allowEmpty,
                );
                if (next !== value) {
                  onValueChange(next);
                }
              }}
            >
              {renderOption ? renderOption(option, { selected }) : option.label}
            </Button>,
          );
          return elements;
        })}
      </div>
    );
  }

  if (props.mode === "multiple" && props.layout === "stacked") {
    const {
      options,
      value,
      ariaLabel,
      className = "",
      disabled = false,
      onValueChange,
      renderOption,
    } = props;

    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={`${styles.stacked} ${className}`.trim()}
      >
        {options.map((option) => {
          const selected = value.includes(option.value);
          const isOptionDisabled = disabled || Boolean(option.disabled);

          const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
            if (isOptionDisabled) return;
            const next = nextMultipleSelection(
              value,
              option.value,
              e.target.checked,
            );
            onValueChange(next);
          };

          return (
            <Checkbox
              key={option.value}
              checked={selected}
              disabled={isOptionDisabled}
              onChange={handleChange}
              className={`${styles.stackedItem} ${selected ? styles.itemSelected : ""} ${isOptionDisabled ? styles.itemDisabled : ""}`.trim()}
            >
              {renderOption ? renderOption(option, { selected }) : option.label}
            </Checkbox>
          );
        })}
      </div>
    );
  }

  return null;
}
