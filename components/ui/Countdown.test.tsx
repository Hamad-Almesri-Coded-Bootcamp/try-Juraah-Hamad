import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Countdown } from './Countdown';
import { copy, t } from '@/i18n';

afterEach(cleanup);

describe('Countdown — never reads a clock', () => {
  it('the source file never calls Date.now(), performance.now() or a bare new Date()', () => {
    const src = readFileSync(join(process.cwd(), 'components/ui/Countdown.tsx'), 'utf8');
    expect(src).not.toMatch(/Date\.now\s*\(/);
    expect(src).not.toMatch(/performance\.now\s*\(/);
    expect(src).not.toMatch(/new\s+Date\s*\(\s*\)/);
  });
});

describe('Countdown — behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('running: shows the remaining seconds, a determinate progressbar, and an always-visible cancel', () => {
    const onCancel = vi.fn();
    render(<Countdown seconds={25} state="running" label="Open the Hawiati app and approve" onCancel={onCancel} lang="en" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuemax', '25');
    expect(screen.getByText('25')).toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: 'Back' });
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('ticks the remaining seconds down once per second, purely from setInterval', () => {
    render(<Countdown seconds={5} state="running" label="Approve" lang="en" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  });

  it('reaches lapsed and calls onLapse exactly once', () => {
    const onLapse = vi.fn();
    render(<Countdown seconds={2} state="running" label="Approve" onLapse={onLapse} lang="en" />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onLapse).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onLapse).toHaveBeenCalledTimes(1);
  });

  it('lapsed state (as controlled by the caller): the lapsed word, a retry button, and a cancel', () => {
    const onRetry = vi.fn();
    const onCancel = vi.fn();
    render(<Countdown seconds={25} state="lapsed" label="Approve" onRetry={onRetry} onCancel={onCancel} lang="en" />);
    expect(screen.getByText('Time ran out')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('completed state: the done word and no progressbar, no cancel, no retry', () => {
    render(<Countdown seconds={25} state="completed" label="Approve" lang="en" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('resets and restarts when the caller flips back to running with a fresh seconds value (retry)', () => {
    const { rerender } = render(<Countdown seconds={25} state="lapsed" label="Approve" lang="en" />);
    rerender(<Countdown seconds={25} state="running" label="Approve" lang="en" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });
});

describe('Countdown — digits follow the language (audit M7, UX Principles §3/§12)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lang="ar": the visible number is Arabic-Indic (٢٥, never 25); aria-valuenow stays a plain number', () => {
    render(<Countdown seconds={25} state="running" label="افتح تطبيق هويّاتي ووافق" lang="ar" />);
    expect(screen.getByText('٢٥')).toBeInTheDocument();
    expect(screen.queryByText('25')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });

  it('lang="ar": the polite ten-second announcement carries Arabic-Indic digits too', () => {
    render(<Countdown seconds={25} state="running" label="افتح تطبيق هويّاتي ووافق" lang="ar" />);
    act(() => {
      vi.advanceTimersByTime(5000); // 25 → 20, a ten-second mark
    });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('٢٠');
    expect(status.textContent).not.toMatch(/[0-9]/);
  });

  it('lang="en": Western digits, unchanged', () => {
    render(<Countdown seconds={25} state="running" label="Approve" lang="en" />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`20 ${t(copy.vocabulary.secondsLeft, 'en')}`);
  });
});
