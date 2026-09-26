import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import {
  PhotoInput,
  targetDimensions,
  nextQuality,
  undecodableOutcome,
  PHOTO_PASSTHROUGH_MAX_BYTES,
} from './PhotoInput';
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

// A1 — the three pure sizing/quality functions, tested directly (no render, no canvas needed).
describe('targetDimensions', () => {
  it('caps a landscape image at the 2000px long edge, keeping its aspect ratio', () => {
    expect(targetDimensions(4000, 3000)).toEqual({ width: 2000, height: 1500 });
  });

  it('caps a portrait image at the 2000px long edge, keeping its aspect ratio', () => {
    expect(targetDimensions(3000, 4000)).toEqual({ width: 1500, height: 2000 });
  });

  it('never upscales an image already under the cap', () => {
    expect(targetDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('is safe for zero dimensions', () => {
    expect(targetDimensions(0, 0)).toEqual({ width: 0, height: 0 });
  });

  it('is safe for NaN dimensions — never throws, never invents a size', () => {
    const result = targetDimensions(Number.NaN, Number.NaN);
    expect(Number.isNaN(result.width)).toBe(true);
    expect(Number.isNaN(result.height)).toBe(true);
  });
});

describe('nextQuality', () => {
  it('steps down by 0.1 from the initial quality to the floor, then stops', () => {
    const steps: Array<number | null> = [];
    let quality: number | null = 0.85;
    while (quality !== null) {
      quality = nextQuality(quality);
      steps.push(quality);
    }
    expect(steps).toEqual([0.75, 0.65, 0.55, 0.45, null]);
  });
});

describe('undecodableOutcome', () => {
  it('passes a file through at exactly the size limit', () => {
    expect(undecodableOutcome(PHOTO_PASSTHROUGH_MAX_BYTES)).toBe('passthrough');
  });

  it('refuses a file one byte over the size limit', () => {
    expect(undecodableOutcome(PHOTO_PASSTHROUGH_MAX_BYTES + 1)).toBe('refuse');
  });
});

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
      const createElementSpy = vi.spyOn(document, 'createElement');
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

      // The mocked decoder reports a 4000x3000 source: the canvas it was drawn to must be capped
      // at the 2000px long edge (targetDimensions), never the source's own size.
      const canvas = createElementSpy.mock.results
        .map((result) => result.value as HTMLElement)
        .find((element) => element.tagName === 'CANVAS') as HTMLCanvasElement;
      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(2000);
      expect(canvas.height).toBe(1500);
      createElementSpy.mockRestore();
    });

    it('steps the JPEG quality down (0.85, 0.75, …) until the re-encoded file is under target', async () => {
      vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })));
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: vi.fn(() => ({ drawImage: vi.fn() })),
      });
      const seenQualities: number[] = [];
      Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        configurable: true,
        value: vi.fn((cb: BlobCallback, _type?: string, quality?: number) => {
          seenQualities.push(quality as number);
          // Stays over PHOTO_TARGET_BYTES for the first two qualities tried, then drops under it —
          // so the loop must step the quality down twice before it can stop.
          const size = (quality as number) > 0.65 ? 3 * 1024 * 1024 : 500_000;
          cb(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
        }),
      });
      const onChange = vi.fn();
      const big = new File([new Uint8Array(6 * 1024 * 1024)], 'prescription.png', { type: 'image/png' });
      render(<PhotoInput value={null} onChange={onChange} label="Photo of your prescription" />);
      chooseFile(big);

      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
      expect(seenQualities).toEqual([0.85, 0.75, 0.65]);
      const sent = onChange.mock.calls[0]![0] as File;
      expect(sent.size).toBeLessThan(2 * 1024 * 1024);
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
