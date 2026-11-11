// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Card from './Card';

describe('Card', () => {
  it('renders its children', () => {
    const { getByText } = render(<Card>Party of four</Card>);
    expect(getByText('Party of four')).toBeTruthy();
  });

  it.each([1, 2, 3, 4] as const)('renders the title as a level %i heading', (level) => {
    const { getByRole } = render(
      <Card title="Opening Hours" titleAs={`h${level}`}>
        Body
      </Card>,
    );
    expect(getByRole('heading', { level, name: 'Opening Hours' })).toBeTruthy();
  });

  it('can render the title as text that is not a heading', () => {
    const { getByText, queryByRole } = render(
      <Card title="New booking" titleAs="p">
        Manually add a reservation.
      </Card>,
    );
    expect(getByText('New booking').tagName).toBe('P');
    expect(queryByRole('heading')).toBeNull();
  });

  it('renders no heading without a title', () => {
    const { queryByRole } = render(<Card>Body</Card>);
    expect(queryByRole('heading')).toBeNull();
  });

  it('renders nothing extra for a falsy title or actions', () => {
    const { container, queryByRole } = render(
      <Card title={null} titleAs="h2" actions={false}>
        <p>Body</p>
      </Card>,
    );
    expect(queryByRole('heading')).toBeNull();
    // Root > body > only the paragraph: no empty title or actions element.
    expect((container.firstElementChild?.firstElementChild as HTMLElement).children.length).toBe(1);
  });

  it('renders the title, then the content, then the actions', () => {
    const { container } = render(
      <Card title="Booking" titleAs="h3" actions={<button type="button">Edit</button>}>
        <p>19:30</p>
      </Card>,
    );
    expect(container.textContent).toBe('Booking19:30Edit');
  });

  it('can be a named section region', () => {
    const { getByRole } = render(
      <Card as="section" aria-labelledby="t" title={<span id="t">Staff Sign In</span>} titleAs="h1">
        Form
      </Card>,
    );
    expect(getByRole('region', { name: 'Staff Sign In' })).toBeTruthy();
  });

  it('passes other attributes to the root', () => {
    const { getByTestId } = render(
      <Card data-testid="oh-card" data-dow="1" id="monday">
        Monday
      </Card>,
    );
    const card = getByTestId('oh-card');
    expect(card.id).toBe('monday');
    expect(card.getAttribute('data-dow')).toBe('1');
  });
});
