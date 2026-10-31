"use client";

import type { ReactNode, ChangeEvent } from "react";
import { Button, Checkbox } from "./Controls";
import styles from "./SelectButton.module.css";

export interface SelectButtonOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
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

export type SelectButtonProps<T extends string> = BaseSelectButtonProps<T> &
  (
    | {
        mode: "single";
        layout: "segmented";
        value: T | null;
        allowEmpty?: boolean;
        onValueChange: (value: T | null) => void;
      }
    | {
        mode: "multiple";
        layout: "stacked";
        value: readonly T[];
        onValueChange: (value: T[]) => void;
      }
  );

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
      onValueChange,
      renderOption,
    } = props;

    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={`${styles.segmented} ${fluid ? styles.fluid : ""} ${className}`.trim()}
      >
        {options.map((option) => {
          const selected = value === option.value;
          const isOptionDisabled = disabled || Boolean(option.disabled);

          return (
            <Button
              key={option.value}
              variant="secondary"
              aria-pressed={selected}
              disabled={isOptionDisabled}
              className={`${styles.segmentedItem} ${selected ? styles.selected : ""}`.trim()}
              onClick={() => {
                if (isOptionDisabled) return;
                if (selected) {
                  if (allowEmpty) {
                    onValueChange(null);
                  }
                } else {
                  onValueChange(option.value);
                }
              }}
            >
              {renderOption ? renderOption(option, { selected }) : option.label}
            </Button>
          );
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
            const checked = e.target.checked;
            let next: T[];
            if (checked) {
              next = value.includes(option.value)
                ? [...value]
                : [...value, option.value];
            } else {
              next = value.filter((v) => v !== option.value);
            }
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
