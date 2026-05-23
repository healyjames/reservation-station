// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import FormField from './FormField';

describe('FormField', () => {
  it('renders without throwing', () => {
    const { container } = render(
      <FormField label="Name"><input /></FormField>
    );
    expect(container.querySelector('label')).toBeTruthy();
  });

  it('renders the label text', () => {
    const { getByText } = render(
      <FormField label="Email Address"><input /></FormField>
    );
    expect(getByText('Email Address')).toBeTruthy();
  });

  it('shows error when error prop is set', () => {
    const { getByText } = render(
      <FormField label="Name" error="Required"><input /></FormField>
    );
    expect(getByText('Required')).toBeTruthy();
  });

  it('hides hint when error is present', () => {
    const { queryByText } = render(
      <FormField label="Name" error="Bad" hint="Your full name"><input /></FormField>
    );
    expect(queryByText('Your full name')).toBeNull();
  });

  it('shows hint when no error', () => {
    const { getByText } = render(
      <FormField label="Name" hint="Your full name"><input /></FormField>
    );
    expect(getByText('Your full name')).toBeTruthy();
  });

  it('appends asterisk when required', () => {
    const { getByText } = render(
      <FormField label="Name" required><input /></FormField>
    );
    expect(getByText('Name *')).toBeTruthy();
  });
});
