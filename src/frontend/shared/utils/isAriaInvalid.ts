type AriaInvalid = boolean | 'true' | 'false' | 'grammar' | 'spelling' | undefined | null;

/**
 * Same rule as daisyUI's validator: any `aria-invalid` value except false is an error. Accepts a Preact signal too,
 * because JSX attributes may be signals. Owned form controls use it to pick their `*-error` class.
 */
export const isAriaInvalid = (value: AriaInvalid | { value: AriaInvalid }): boolean => {
  const raw = value !== null && typeof value === 'object' ? value.value : value;
  return raw !== undefined && raw !== null && raw !== false && raw !== 'false';
};
