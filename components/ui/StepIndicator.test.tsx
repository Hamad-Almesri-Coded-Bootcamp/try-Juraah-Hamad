import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StepIndicator } from './StepIndicator';

afterEach(cleanup);

describe('StepIndicator', () => {
  it('renders an <ol> with one <li> per step and aria-current="step" on the current one', () => {
    const { container } = render(<StepIndicator steps={['Language', 'Offer', 'Invite', 'Closing']} current={1} label="Setup progress" lang="en" />);
    const list = container.querySelector('ol.wsf-stepind__list');
    expect(list).toBeInTheDocument();
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(4);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[2]).not.toHaveAttribute('aria-current');
  });

  it('renders a "Step X of Y" caption from the vocabulary', () => {
    const { container } = render(<StepIndicator steps={['a', 'b', 'c']} current={0} label="Setup" lang="en" />);
    const caption = container.querySelector('.wsf-stepind__caption');
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Step 1 of 3');
  });

  it('marks the last step correctly (last of three)', () => {
    const { container } = render(<StepIndicator steps={['a', 'b', 'c']} current={2} label="Setup" lang="en" />);
    const items = container.querySelectorAll('li');
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).toHaveClass('wsf-stepind__item--current');
    expect(items[0]).toHaveClass('wsf-stepind__item--done');
  });

  it('throws when given more than four steps', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<StepIndicator steps={['1', '2', '3', '4', '5']} current={0} label="Too many" lang="en" />)).toThrow();
    spy.mockRestore();
  });

  it('each step label is available to assistive technology even though the bar itself is decorative', () => {
    const { container } = render(<StepIndicator steps={['Language', 'Offer']} current={0} label="Setup" lang="en" />);
    expect(screen.getByText('Language')).toHaveClass('wsf-sr');
    const bar = container.querySelector('.wsf-stepind__bar');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });
});
