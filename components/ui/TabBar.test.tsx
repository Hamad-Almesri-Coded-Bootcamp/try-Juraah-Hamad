import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { TabBar, type TabBarItem } from './TabBar';

afterEach(cleanup);

const PATIENT_ITEMS: [TabBarItem, TabBarItem, TabBarItem, TabBarItem] = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'medicines', label: 'My Medicines', icon: 'capsule' },
  { id: 'safety', label: 'Safety', icon: 'shield' },
  { id: 'more', label: 'More', icon: 'settings' },
];

describe('TabBar', () => {
  it('sets exactly one aria-current="page"', () => {
    render(<TabBar items={PATIENT_ITEMS} value="safety" label="Main navigation" />);
    const current = screen.getAllByRole('button').filter((el) => el.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName('Safety');
  });

  it('renders a visible label for every item', () => {
    render(<TabBar items={PATIENT_ITEMS} value="today" label="Main navigation" />);
    for (const item of PATIENT_ITEMS) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
  });

  it('calls onChange with the item id on click', () => {
    const onChange = vi.fn();
    render(<TabBar items={PATIENT_ITEMS} value="today" onChange={onChange} label="Main navigation" />);
    screen.getByRole('button', { name: 'Safety' }).click();
    expect(onChange).toHaveBeenCalledWith('safety');
  });

  it('renders items as real links when href is present, and still calls onChange', () => {
    const onChange = vi.fn();
    const items: [TabBarItem, TabBarItem] = [
      { id: 'review', label: 'Review', icon: 'review', href: '/en/clinic/review' },
      { id: 'audit', label: 'Audit', icon: 'search', href: '/en/clinic/audit' },
    ];
    render(<TabBar items={items} value="review" onChange={onChange} label="Clinic navigation" />);
    const link = screen.getByRole('link', { name: 'Review' });
    expect(link).toHaveAttribute('href', '/en/clinic/review');
    link.click();
    expect(onChange).toHaveBeenCalledWith('review');
  });

  it('folds a badge count into the item’s accessible name, built from the consumer’s own label', () => {
    const items: [TabBarItem, TabBarItem, TabBarItem] = [
      { id: 'today', label: 'Today', icon: 'home' },
      { id: 'medicines', label: 'Medicines', icon: 'capsule' },
      { id: 'more', label: 'More', icon: 'settings', badge: 2 },
    ];
    render(<TabBar items={items} value="today" label="Caregiver navigation" />);
    expect(screen.getByRole('button', { name: 'More 2' })).toBeInTheDocument();
  });

  it('applies the auto layout class by default and the forced layout class when set', () => {
    const { rerender, container } = render(<TabBar items={PATIENT_ITEMS} value="today" label="Nav" />);
    expect(container.querySelector('nav')).toHaveClass('wsf-tabs--auto');
    rerender(<TabBar items={PATIENT_ITEMS} value="today" label="Nav" layout="side" />);
    expect(container.querySelector('nav')).toHaveClass('wsf-tabs--side');
  });

  it('uses the label prop as the navigation landmark’s accessible name', () => {
    render(<TabBar items={PATIENT_ITEMS} value="today" label="Main navigation" />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('refuses a 5th item at the type level', () => {
    // Compile-time only — never invoked. tsc fails on this file if the @ts-expect-error becomes
    // unnecessary (i.e. if a 5-item array were ever accepted by TabBarItems).
    function neverCalled() {
      // @ts-expect-error TabBarItems is a tuple union capped at 4 items (G8)
      const items: import('./TabBar').TabBarItems = [
        { id: 'a', label: 'A', icon: 'home' },
        { id: 'b', label: 'B', icon: 'home' },
        { id: 'c', label: 'C', icon: 'home' },
        { id: 'd', label: 'D', icon: 'home' },
        { id: 'e', label: 'E', icon: 'home' },
      ];
      return items;
    }
    expect(typeof neverCalled).toBe('function');
  });
});
