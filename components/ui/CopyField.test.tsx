import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { CopyField } from './CopyField';

afterEach(cleanup);

const PLACEHOLDER_LINK = 'webcal://jurah.app/ics/[TOKEN]';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});
afterEach(() => {
  writeText.mockClear();
  // @ts-expect-error — jsdom does not implement the Clipboard API; the test-only stub above does.
  delete navigator.clipboard;
});

describe('CopyField', () => {
  it('renders a read-only, ltr value under its label', () => {
    render(<CopyField label="Calendar link" value={PLACEHOLDER_LINK} />);
    const input = screen.getByLabelText('Calendar link') as HTMLInputElement;
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('dir', 'ltr');
    expect(input).toHaveValue(PLACEHOLDER_LINK);
  });

  it('the copy button has an accessible name', () => {
    render(<CopyField label="Calendar link" value={PLACEHOLDER_LINK} />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('copying calls the clipboard and announces the confirmation as role="status"', async () => {
    render(<CopyField label="Calendar link" value={PLACEHOLDER_LINK} />);
    expect(screen.getByRole('status')).toHaveTextContent('');
    screen.getByRole('button', { name: 'Copy' }).click();
    expect(writeText).toHaveBeenCalledWith(PLACEHOLDER_LINK);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copied'));
  });
});
