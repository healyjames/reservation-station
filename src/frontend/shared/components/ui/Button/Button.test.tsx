// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import Button from './Button';
import { ChevronLeft } from '../icons';

describe('Button', () => {
  it('renders its children as the accessible name', () => {
    const { getByRole } = render(<Button>Book now</Button>);
    expect(getByRole('button', { name: 'Book now' })).toBeTruthy();
  });

  it('forwards aria-label so icon-only buttons are named', () => {
    const { getByRole } = render(
      <Button aria-label="Previous month">
        <ChevronLeft />
      </Button>,
    );
    expect(getByRole('button', { name: 'Previous month' })).toBeTruthy();
  });

  it('forwards other attributes such as id, form and data-*', () => {
    const { getByRole } = render(
      <Button id="prev-step-btn" form="booking-form-step2" data-testid="prev">
        Back
      </Button>,
    );
    const button = getByRole('button', { name: 'Back' });
    expect(button.id).toBe('prev-step-btn');
    expect(button.getAttribute('form')).toBe('booking-form-step2');
    expect(button.dataset.testid).toBe('prev');
  });

  it('defaults type to "button" so it never submits a form by accident', () => {
    const { getByRole } = render(<Button>Next</Button>);
    expect(getByRole('button', { name: 'Next' }).getAttribute('type')).toBe('button');
  });

  it('allows type="submit"', () => {
    const { getByRole } = render(<Button type="submit">Save</Button>);
    expect(getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('submit');
  });

  it('calls onClick when enabled', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and does not call onClick when disabled', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const button = getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is disabled, busy and does not call onClick while loading', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button isLoading onClick={onClick}>
        Save
      </Button>,
    );
    const button = getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps the visible text as its name while loading, without a nested status', () => {
    const { getByRole, queryByRole } = render(<Button isLoading>Save</Button>);
    expect(getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(queryByRole('status')).toBeNull();
  });

  it('is not marked busy when not loading, even if a caller passes aria-busy', () => {
    const { getByRole } = render(<Button {...{ 'aria-busy': 'true' }}>Save</Button>);
    expect(getByRole('button', { name: 'Save' }).getAttribute('aria-busy')).toBeNull();
  });

  it('renders every variant, size and shape without error', () => {
    const { getAllByRole } = render(
      <>
        <Button variant="primary" size="sm" block>
          A
        </Button>
        <Button variant="error" shape="square" aria-label="B" />
        <Button variant="ghost" shape="circle" aria-label="C" />
      </>,
    );
    expect(getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['A', 'B', 'C']);
  });
});
