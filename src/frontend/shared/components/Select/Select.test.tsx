// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Select from './Select';

const OPTIONS = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
];

describe('Select', () => {
  it('renders without throwing', () => {
    const { container } = render(<Select options={OPTIONS} />);
    expect(container.querySelector('select')).toBeTruthy();
  });

  it('renders all options', () => {
    const { getAllByRole } = render(<Select options={OPTIONS} />);
    expect(getAllByRole('option').length).toBe(2);
  });

  it('renders placeholder as extra option', () => {
    const { getAllByRole } = render(<Select options={OPTIONS} placeholder="Pick one" />);
    expect(getAllByRole('option').length).toBe(3);
  });

  it('shows error text when error prop is set', () => {
    const { getByText } = render(<Select options={OPTIONS} error="Required" />);
    expect(getByText('Required')).toBeTruthy();
  });
});
