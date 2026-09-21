import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import { Sheet } from './Sheet';

afterEach(cleanup);

function Harness({ mode }: { mode?: 'auto' | 'sheet' | 'modal' }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Confirm refill" closeLabel="Close" mode={mode}>
        <p>Warfarin — Al Sabah pharmacy</p>
        <button type="button">Confirm</button>
      </Sheet>
    </div>
  );
}

describe('Sheet', () => {
  it('renders nothing in the DOM when open is false', () => {
    render(<Sheet open={false} title="Confirm refill" closeLabel="Close" onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a real modal dialog labelled by its title', () => {
    render(
      <Sheet open onClose={() => {}} title="Confirm refill" closeLabel="Close">
        content
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Confirm refill' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus in on open and restores it to the opener on close', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.activeElement).not.toBe(opener);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it('traps focus with Tab, cycling from the last focusable back to the first', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog');
    const focusables = dialog.querySelectorAll('button');
    const last = focusables[focusables.length - 1] as HTMLElement;
    const first = focusables[0] as HTMLElement;

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Confirm refill" closeLabel="Close">
        content
      </Sheet>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a scrim click, and the scrim is a real labelled button', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Sheet open onClose={onClose} title="Confirm refill" closeLabel="Close">
        content
      </Sheet>,
    );
    const scrim = container.querySelector('.wsf-sheet__scrim');
    expect(scrim?.tagName).toBe('BUTTON');
    expect(scrim).toHaveAccessibleName('Close');
    fireEvent.click(scrim as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it on close', () => {
    render(<Harness />);
    expect(document.body.style.overflow).not.toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders no close control and no submit of its own when onClose is omitted', () => {
    render(
      <Sheet open title="Subscribe" footer={<button type="button">Done</button>}>
        instructions
      </Sheet>,
    );
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('form')).toBeNull();
  });

  it('renders the sheet mode as a bottom sheet or a centred modal on request', () => {
    const { container: sheetContainer } = render(
      <Sheet open onClose={() => {}} title="t" closeLabel="Close" mode="sheet">
        c
      </Sheet>,
    );
    expect(sheetContainer.querySelector('.wsf-sheet-root')).toHaveClass('wsf-sheet-root--sheet');

    const { container: modalContainer } = render(
      <Sheet open onClose={() => {}} title="t" closeLabel="Close" mode="modal">
        c
      </Sheet>,
    );
    expect(modalContainer.querySelector('.wsf-sheet-root')).toHaveClass('wsf-sheet-root--modal');
  });
});
