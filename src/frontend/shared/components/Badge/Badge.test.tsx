// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Badge from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    const { getByText } = render(<Badge>2 guests</Badge>);
    expect(getByText('2 guests')).toBeTruthy();
  });

  it('applies default variant class when no variant given', () => {
    const { container } = render(<Badge>Label</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('badge');
    expect(el.className).toContain('default');
  });

  it('applies primary variant class', () => {
    const { container } = render(<Badge variant="primary">Primary</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('primary');
  });

  it('applies today variant class', () => {
    const { container } = render(<Badge variant="today">Today</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('today');
  });

  it('forwards extra class prop', () => {
    const { container } = render(<Badge class="extra">Label</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('extra');
  });
});
