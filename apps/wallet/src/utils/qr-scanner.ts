import jsQR from 'jsqr';

/**
 * Starts scanning QR codes from a video element using the camera.
 * Returns a cleanup function to stop the scanner.
 */
export function startScanner(
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement,
  onResult: (data: string) => void
): () => void {
  let animationId: number;
  let stream: MediaStream | null = null;
  let stopped = false;

  const scan = () => {
    if (stopped) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          onResult(code.data);
          return; // Stop scanning after first result
        }
      }
    }
    animationId = requestAnimationFrame(scan);
  };

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'environment' } })
    .then((mediaStream) => {
      if (stopped) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = mediaStream;
      videoEl.srcObject = mediaStream;
      videoEl.play();
      animationId = requestAnimationFrame(scan);
    })
    .catch(() => {
      // Camera permission denied — handled by caller
    });

  return () => {
    stopped = true;
    cancelAnimationFrame(animationId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    videoEl.srcObject = null;
  };
}
