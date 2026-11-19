// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import type { FunctionComponent } from 'preact';
import { describe, it, expect } from 'vitest';
import * as icons from './index';
import type { IconProps } from './index';

const allIcons = Object.entries(icons) as [string, FunctionComponent<IconProps>][];

describe('icons', () => {
  it('exports every icon the app needs', () => {
    expect(allIcons.map(([name]) => name).sort()).toEqual(
      [
        'ArrowLeft',
        'ArrowRight',
        'CalendarDays',
        'CalendarX',
        'ChevronLeft',
        'ChevronRight',
        'CircleAlert',
        'CircleCheck',
        'Clock',
        'Info',
        'LogOut',
        'Moon',
        'PanelLeftClose',
        'PanelLeftOpen',
        'Pencil',
        'Plus',
        'RefreshCw',
        'SlidersHorizontal',
        'Sun',
        'Trash2',
        'X',
      ].sort(),
    );
  });

  it.each(allIcons)('%s is decorative by default: hidden from assistive tech, with no role', (_, IconComponent) => {
    const { container, queryByRole } = render(<IconComponent />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(queryByRole('img', { hidden: true })).toBeNull();
    expect(svg?.childElementCount).toBeGreaterThan(0);
  });

  it('identifies each icon with a unique data-icon name', () => {
    const { container } = render(
      <>
        {allIcons.map(([name, IconComponent]) => (
          <IconComponent key={name} />
        ))}
      </>,
    );
    const names = Array.from(container.querySelectorAll('svg')).map((svg) => svg.getAttribute('data-icon'));
    expect(names).not.toContain(null);
    expect(new Set(names).size).toBe(allIcons.length);
    expect(container.querySelector('[data-icon="chevron-left"]')).not.toBeNull();
  });

  it('has an image role and accessible name when given a title', () => {
    const { getByRole } = render(<icons.CalendarDays title="Bookings" />);
    const img = getByRole('img', { name: 'Bookings' });
    expect(img.getAttribute('aria-hidden')).toBeNull();
  });

  it('treats an empty title as decorative', () => {
    const { container, queryByRole } = render(<icons.X title="" />);
    expect(queryByRole('img', { hidden: true })).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps its own accessibility when a caller passes ARIA attributes', () => {
    const { container } = render(
      <>
        <icons.Plus id="decorative" {...{ role: 'button', 'aria-hidden': 'false', 'aria-label': 'Other' }} />
        <icons.Plus id="named" title="Add" {...{ role: 'button', 'aria-hidden': 'true', 'aria-labelledby': 'elsewhere' }} />
      </>,
    );
    const decorative = container.querySelector('#decorative');
    expect(decorative?.getAttribute('role')).toBeNull();
    expect(decorative?.getAttribute('aria-hidden')).toBe('true');
    expect(decorative?.getAttribute('aria-label')).toBeNull();

    const named = container.querySelector('#named');
    expect(named?.getAttribute('role')).toBe('img');
    expect(named?.getAttribute('aria-hidden')).toBeNull();
    expect(named?.getAttribute('aria-labelledby')).toBeNull();
    expect(named?.getAttribute('aria-label')).toBe('Add');
  });

  it('matches the text size by default and takes a size in px', () => {
    const { container } = render(
      <>
        <icons.Sun id="default" />
        <icons.Sun id="small" size={16} />
      </>,
    );
    expect(container.querySelector('#default')?.getAttribute('width')).toBe('1em');
    expect(container.querySelector('#default')?.getAttribute('height')).toBe('1em');
    expect(container.querySelector('#small')?.getAttribute('width')).toBe('16');
    expect(container.querySelector('#small')?.getAttribute('height')).toBe('16');
  });

  it('draws in the current text colour', () => {
    const { container } = render(<icons.Moon />);
    expect(container.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
  });

  it('passes other attributes through to the svg', () => {
    const { container } = render(<icons.Info id="tip-icon" data-testid="tip" />);
    const svg = container.querySelector('svg');
    expect(svg?.id).toBe('tip-icon');
    expect(svg?.getAttribute('data-testid')).toBe('tip');
  });
});
