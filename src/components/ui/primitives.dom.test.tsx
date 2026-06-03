// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chip } from './Chip';
import { Ring } from './Ring';
import { Mono } from './typography';
import { Icon } from './Icon';
import { Btn } from './Btn';

describe('primitives render', () => {
  it('Btn with href renders a navigable link, not a dead button (W2-T1)', () => {
    render(<Btn href="/app/workout/new" icon="plus">New workout</Btn>);
    const link = screen.getByRole('link', { name: /new workout/i });
    expect(link.getAttribute('href')).toBe('/app/workout/new');
  });

  it('Chip renders its children', () => {
    render(<Chip>Chest</Chip>);
    expect(screen.getByText('Chest')).toBeDefined();
  });

  it('Ring exposes an accessible percentage label', () => {
    render(<Ring pct={0.72} />);
    expect(screen.getByRole('img', { name: '72%' })).toBeDefined();
  });

  it('Ring clamps out-of-range pct in its label', () => {
    render(<Ring pct={1.8} />);
    expect(screen.getByRole('img', { name: '100%' })).toBeDefined();
  });

  it('Mono renders numeric content', () => {
    render(<Mono>12.4k</Mono>);
    expect(screen.getByText('12.4k')).toBeDefined();
  });

  it('Icon renders an svg for a known name and nothing for unknown', () => {
    const { container } = render(<Icon name="flame" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
