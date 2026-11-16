import type { FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';
import type { ThemeMode, ThemeName } from '@shared/styles/themes';
import { SwapCheckbox, type SwapCheckboxProps } from '../Swap';
import { Moon, Sun } from '../icons';

type OwnedProps = 'label' | 'checked' | 'onChange' | 'on' | 'off';

export type ThemeControllerProps = Omit<SwapCheckboxProps, OwnedProps> & {
  /** Theme used when the toggle is off, e.g. `admin-light`. Fixed for the component's lifetime. */
  lightTheme: ThemeName;
  /** Theme used when the toggle is on, e.g. `admin-dark`. Fixed for the component's lifetime. */
  darkTheme: ThemeName;
  /** Called with the theme just applied and its mode. Storing the choice is up to the caller. */
  onChange?: (theme: ThemeName, mode: ThemeMode) => void;
};

/**
 * "Dark mode" toggle: switches `<html data-theme>` between two daisyUI themes. Its initial state is read from the
 * current `data-theme` (set before first paint by public/js/theme.js); anything other than `lightTheme` counts as dark,
 * matching the dark default of theme.js and the theme files. It stores nothing.
 *
 * One instance per page: changes to `data-theme` made elsewhere are not tracked. It does not use daisyUI's CSS
 * `theme-controller` input, whose `:root:has(...)` state lives only in the checkbox and would fight theme.js.
 */
const ThemeController: FunctionComponent<ThemeControllerProps> = ({ lightTheme, darkTheme, onChange, ...rest }) => {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') !== lightTheme);

  return (
    <SwapCheckbox
      {...rest}
      label="Dark mode"
      checked={dark}
      onChange={(checked) => {
        const theme = checked ? darkTheme : lightTheme;
        document.documentElement.setAttribute('data-theme', theme);
        setDark(checked);
        onChange?.(theme, checked ? 'dark' : 'light');
      }}
      on={<Moon />}
      off={<Sun />}
    />
  );
};

export default ThemeController;
