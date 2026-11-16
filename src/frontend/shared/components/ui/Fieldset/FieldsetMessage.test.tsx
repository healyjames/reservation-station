// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import FieldsetMessage from './FieldsetMessage';

describe('FieldsetMessage', () => {
  it('shows the caption over its message without labelling anything', () => {
    const { getByText, container } = render(
      <FieldsetMessage label="Time">
        <p>No times available</p>
      </FieldsetMessage>,
    );
    expect(getByText('Time')).toBeTruthy();
    expect(getByText('No times available')).toBeTruthy();
    expect(container.querySelector('label')).toBeNull();
  });

  it('shows a required marker that is hidden from assistive tech', () => {
    const { getByText } = render(
      <FieldsetMessage label="Time" required>
        <p>Loading</p>
      </FieldsetMessage>,
    );
    expect(getByText('*').getAttribute('aria-hidden')).toBe('true');
  });

  it('has no marker unless required', () => {
    const { queryByText } = render(
      <FieldsetMessage label="Time">
        <p>Loading</p>
      </FieldsetMessage>,
    );
    expect(queryByText('*')).toBeNull();
  });

  it('passes other attributes to the root', () => {
    const { getByTestId } = render(
      <FieldsetMessage label="Time" data-testid="msg" id="time-msg">
        <p>Loading</p>
      </FieldsetMessage>,
    );
    expect(getByTestId('msg').id).toBe('time-msg');
  });
});
