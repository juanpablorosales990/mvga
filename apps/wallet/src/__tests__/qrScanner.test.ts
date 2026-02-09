import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock jsQR before importing the module
vi.mock('jsqr', () => ({
  default: vi.fn(),
}));

import jsQR from 'jsqr';
import { startScanner } from '../utils/qr-scanner';

describe('qr-scanner', () => {
  let mockVideoEl: HTMLVideoElement;
  let mockCanvasEl: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;
  let mockStream: MediaStream;
  let mockTrack: MediaStreamTrack;
  let getUserMediaMock: ReturnType<typeof vi.fn>;
  let rafCallbacks: FrameRequestCallback[];
  let rafIdCounter: number;

  beforeEach(() => {
    rafCallbacks = [];
    rafIdCounter = 0;

    // Mock video element
    mockVideoEl = {
      readyState: 4, // HAVE_ENOUGH_DATA
      HAVE_ENOUGH_DATA: 4,
      videoWidth: 640,
      videoHeight: 480,
      srcObject: null,
      play: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLVideoElement;

    // Mock canvas context
    mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
      }),
    } as unknown as CanvasRenderingContext2D;

    // Mock canvas element
    mockCanvasEl = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as HTMLCanvasElement;

    // Mock media stream
    mockTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
    mockStream = { getTracks: vi.fn().mockReturnValue([mockTrack]) } as unknown as MediaStream;

    // Mock getUserMedia
    getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: getUserMediaMock },
    });

    // Collect rAF callbacks without auto-executing them
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return ++rafIdCounter;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Flush all pending microtasks (e.g., resolved getUserMedia promise) */
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));

  /** Execute the next queued rAF callback */
  const tickRaf = () => {
    const cb = rafCallbacks.shift();
    if (cb) cb(performance.now());
  };

  it('requests camera with environment facing mode', async () => {
    startScanner(mockVideoEl, mockCanvasEl, vi.fn());
    await flush();

    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
    });
  });

  it('assigns stream to video element and plays', async () => {
    startScanner(mockVideoEl, mockCanvasEl, vi.fn());
    await flush();

    expect(mockVideoEl.srcObject).toBe(mockStream);
    expect(mockVideoEl.play).toHaveBeenCalled();
  });

  it('calls onResult when jsQR detects a QR code', async () => {
    const onResult = vi.fn();
    (jsQR as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: 'solana:ABC123' });

    startScanner(mockVideoEl, mockCanvasEl, onResult);
    await flush(); // getUserMedia resolves, rAF queued
    tickRaf(); // Execute scan — jsQR finds code

    expect(onResult).toHaveBeenCalledWith('solana:ABC123');
  });

  it('queues another rAF when no QR code detected', async () => {
    const onResult = vi.fn();
    (jsQR as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);

    startScanner(mockVideoEl, mockCanvasEl, onResult);
    await flush();
    const initialRafCount = rafCallbacks.length;
    tickRaf(); // scan runs, no QR found — should queue another rAF

    expect(onResult).not.toHaveBeenCalled();
    // A new rAF should have been queued
    expect(rafCallbacks.length).toBe(initialRafCount); // one consumed, one added
  });

  it('cleanup function stops tracks and clears srcObject', async () => {
    const cleanup = startScanner(mockVideoEl, mockCanvasEl, vi.fn());
    await flush();

    cleanup();

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(mockVideoEl.srcObject).toBeNull();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('handles camera permission denied gracefully', async () => {
    getUserMediaMock.mockRejectedValue(new Error('Permission denied'));
    const onResult = vi.fn();

    // Should not throw
    startScanner(mockVideoEl, mockCanvasEl, onResult);
    await flush();

    expect(onResult).not.toHaveBeenCalled();
  });

  it('stops stream if stopped before getUserMedia resolves', async () => {
    let resolveGetUserMedia!: (stream: MediaStream) => void;
    getUserMediaMock.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        resolveGetUserMedia = resolve;
      })
    );

    const cleanup = startScanner(mockVideoEl, mockCanvasEl, vi.fn());
    cleanup(); // Stop before camera connects

    // Now resolve getUserMedia
    resolveGetUserMedia(mockStream);
    await flush();

    // Stream should be stopped since we called cleanup before it resolved
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
