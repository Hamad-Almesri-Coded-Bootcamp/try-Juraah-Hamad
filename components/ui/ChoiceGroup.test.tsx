import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ChoiceGroup } from './ChoiceGroup';

afterEach(cleanup);

const OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'alternate', label: 'Every other day' },
];

describe('ChoiceGroup', () => {
  it('renders a fieldset/legend grouping real radio inputs', () => {
    render(<ChoiceGroup name="freq" label="Check-in frequency" value="daily" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Check-in frequency' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Daily' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Every other day' })).not.toBeChecked();
  });

  it('calls onChange with the newly chosen value', () => {
    const onChange = vi.fn();
    render(<ChoiceGroup name="freq" label="Check-in frequency" value="daily" options={OPTIONS} onChange={onChange} />);
    screen.getByRole('radio', { name: 'Every other day' }).click();
    // native radios update via change events, which JSDOM's click() on a label-associated input fires.
    expect(onChange).toHaveBeenCalledWith('alternate');
  });

  it('the radio variant shows each option’s description', () => {
    const withDesc = [
      { value: 'telegram', label: 'Telegram', description: 'Alerts and check-ins' },
      { value: 'email', label: 'Email', description: 'Alerts only' },
    ];
    render(<ChoiceGroup variant="radio" name="channel" label="Notification channel" value="telegram" options={withDesc} onChange={() => {}} />);
    expect(screen.getByText('Alerts and check-ins')).toBeInTheDocument();
    expect(screen.getByText('Alerts only')).toBeInTheDocument();
  });

  it('disables every option when the group is disabled', () => {
    render(<ChoiceGroup name="freq" label="Check-in frequency" value="daily" options={OPTIONS} onChange={() => {}} disabled />);
    expect(screen.getByRole('radio', { name: 'Daily' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Every other day' })).toBeDisabled();
  });
});
