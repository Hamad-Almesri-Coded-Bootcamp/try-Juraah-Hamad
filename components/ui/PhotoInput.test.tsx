import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { PhotoInput } from './PhotoInput';
import { copy, t } from '@/i18n';

afterEach(cleanup);

// jsdom does not implement the Blob URL API; PhotoInput calls it whenever `value` is set.
// jsdom also has no createImageBitmap and no real <canvas> (A1): by default createImageBitmap is
// undefined (as in jsdom) and the <img> fallback fails on the same tick, so any test that does not
// opt into the decode-success mocks below stays fast and deterministic, landing on the
// passthrough/refuse rule — exactly like a real browser that cannot decode the file at all.
beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal('createImageBitmap', undefined);
  class FailingImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => this.onerror?.());
    }
  }
  vi.stubGlobal('Image', FailingImage);
});
afterEach(() => vi.unstubAllGlobals());

const file = new File(['x'], 'prescription.jpg', { type: 'image/jpeg' });

/** A1 — a working decoder plus a <canvas> that re-encodes to `bytes`, for the one test that exercises
 * the resize path itself; every other test relies on the file-level default (cannot decode at all). */
function mockWorkingDecoder(bytes: number) {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })));
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({ drawImage: vi.fn() })),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: vi.fn((cb: BlobCallback) => cb(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }))),
  });
}

function chooseFile(picked: File) {
  const input = screen.getByLabelText('Choose a photo') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [picked] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

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

  it('calls onChange with the chosen file (undecodable in this test environment, so passed through as-is)', async () => {
    const onChange = vi.fn();
    render(<PhotoInput value={null} onChange={onChange} label="Photo of your prescription" />);
    chooseFile(file);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(file));
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
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  // A1 — client-side downscale (mocked createImageBitmap/canvas: jsdom has neither for real).
  describe('A1 — downscale before sending', () => {
    it('a big image is decoded, downscaled and re-encoded as a smaller JPEG', async () => {
      mockWorkingDecoder(500_000); // 500 KB, comfortably under PHOTO_TARGET_BYTES
      const onChange = vi.fn();
      const big = new File([new Uint8Array(6 * 1024 * 1024)], 'prescription.png', { type: 'image/png' });
      render(<PhotoInput value={null} onChange={onChange} label="Photo of your prescription" />);
      chooseFile(big);

      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
      const sent = onChange.mock.calls[0]![0] as File;
      expect(sent).not.toBe(big);
      expect(sent.type).toBe('image/jpeg');
      expect(sent.name).toBe('prescription.jpg');
      expect(sent.size).toBeLessThan(2 * 1024 * 1024);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('a file the browser cannot decode passes through unresized when it already fits', async () => {
      vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('cannot decode'); }));
      const onChange = vi.fn();
      const undecodable = new File([new Uint8Array(3 * 1024 * 1024)], 'prescription.heic', { type: 'image/heic' });
      render(<PhotoInput value={null} onChange={onChange} label="Photo of your prescription" />);
      chooseFile(undecodable);

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(undecodable));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('a file the browser cannot decode, over the size limit, is refused with the copy line and never sent', async () => {
      vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('cannot decode'); }));
      const onChange = vi.fn();
      const tooBig = new File([new Uint8Array(4 * 1024 * 1024)], 'prescription.heic', { type: 'image/heic' });
      render(<PhotoInput value={null} onChange={onChange} label="Photo of your prescription" />);
      chooseFile(tooBig);

      await screen.findByText(t(copy.vocabulary.photoTooLargeToSend, 'en'));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
