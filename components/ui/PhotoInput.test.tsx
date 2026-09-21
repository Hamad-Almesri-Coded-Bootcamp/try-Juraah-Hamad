import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { PhotoInput } from './PhotoInput';

afterEach(cleanup);

// jsdom does not implement the Blob URL API; PhotoInput calls it whenever `value` is set.
beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});
afterEach(() => vi.unstubAllGlobals());

const file = new File(['x'], 'prescription.jpg', { type: 'image/jpeg' });

describe('PhotoInput', () => {
  it('idle exposes two labelled file inputs — take a photo and choose a photo', () => {
    render(<PhotoInput value={null} onChange={() => {}} label="Photo of your prescription" />);
    const takePhoto = screen.getByLabelText('Take a photo') as HTMLInputElement;
    const choosePhoto = screen.getByLabelText('Choose a photo') as HTMLInputElement;
    expect(takePhoto.type).toBe('file');
    expect(choosePhoto.type).toBe('file');
    expect(takePhoto).toHaveAttribute('capture', 'environment');
    expect(choosePhoto).not.toHaveAttribute('capture');
  });

  it('calls onChange with the chosen file', () => {
    const onChange = vi.fn();
    render(<PhotoInput value={null} onChange={onChange} label="Photo of your prescription" />);
    const input = screen.getByLabelText('Choose a photo') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(file);
  });

  it('preview shows the chosen image and a Remove action', () => {
    render(<PhotoInput value={file} onChange={() => {}} label="Photo of your prescription" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:mock-url');
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('analysing has no enabled file input and no Remove action, and announces itself as busy', () => {
    const { container } = render(<PhotoInput value={file} onChange={() => {}} state="analysing" label="Photo of your prescription" />);
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getByText('Analysing…')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
