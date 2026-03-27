export async function recordCanvas(
  canvas: HTMLCanvasElement,
  durationMs: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);

    // Try webm, fall back to whatever is available
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";

    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: 5_000_000,
    });

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, {
        type: mimeType || "video/webm",
      });
      resolve(blob);
    };

    recorder.onerror = () => reject(new Error("Recording failed"));

    recorder.start(100); // collect data every 100ms

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      onProgress?.(Math.min(1, elapsed / durationMs));
    }, 100);

    setTimeout(() => {
      clearInterval(progressInterval);
      onProgress?.(1);
      recorder.stop();
    }, durationMs);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
