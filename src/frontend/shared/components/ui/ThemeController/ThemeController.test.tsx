// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ThemeMode, ThemeName } from '@shared/styles/themes';
import ThemeController from './ThemeController';

const setTheme = (theme: string) => document.documentElement.setAttribute('data-theme', theme);
const theme = () => document.documentElement.getAttribute('data-theme');

const renderToggle = (onChange?: (theme: ThemeName, mode: ThemeMode) => void) =>
  render(<ThemeController lightTheme="admin-light" darkTheme="admin-dark" onChange={onChange} />);

describe('ThemeController', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('is a "Dark mode" checkbox, checked when the dark theme is active', () => {
    setTheme('admin-dark');
    const { getByRole } = renderToggle();
    expect(getByRole('checkbox', { name: 'Dark mode', checked: true })).toBeTruthy();
  });

  it('is unchecked when the light theme is active', () => {
    setTheme('admin-light');
    const { getByRole } = renderToggle();
    expect(getByRole('checkbox', { name: 'Dark mode', checked: false })).toBeTruthy();
  });

  it.each([null, 'default-dark', 'unknown'])('treats a data-theme of %s as dark, like the theme.js default', (initial) => {
    if (initial) setTheme(initial);
    const { getByRole } = renderToggle();
    expect(getByRole('checkbox', { name: 'Dark mode', checked: true })).toBeTruthy();
  });

  it('switches to the light theme and reports it', () => {
    setTheme('admin-dark');
    const onChange = vi.fn();
    const { getByRole } = renderToggle(onChange);
    fireEvent.click(getByRole('checkbox'));
    expect(theme()).toBe('admin-light');
    expect(getByRole('checkbox', { checked: false })).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('admin-light', 'light');
  });

  it('switches back to the dark theme', () => {
    setTheme('admin-light');
    const onChange = vi.fn();
    const { getByRole } = renderToggle(onChange);
    fireEvent.click(getByRole('checkbox'));
    expect(theme()).toBe('admin-dark');
    expect(getByRole('checkbox', { checked: true })).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith('admin-dark', 'dark');
  });

  it('works without onChange', () => {
    setTheme('admin-dark');
    const { getByRole } = renderToggle();
    fireEvent.click(getByRole('checkbox'));
    expect(theme()).toBe('admin-light');
  });

  it('stores nothing', () => {
    setTheme('admin-dark');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { getByRole } = renderToggle();
    fireEvent.click(getByRole('checkbox'));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
