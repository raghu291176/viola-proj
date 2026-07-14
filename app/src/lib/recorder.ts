// Real microphone capture via MediaRecorder. Produces an audio Blob that the
// backend worker (librosa/basic-pitch, ffmpeg-backed) can decode.

let mediaRecorder: MediaRecorder | null = null;
let chunks: BlobPart[] = [];
let stream: MediaStream | null = null;

export function recordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;
}

export async function startMicRecording(): Promise<void> {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.start();
}

export function stopMicRecording(): Promise<Blob> {
  return new Promise((resolve) => {
    const mr = mediaRecorder;
    if (!mr) { resolve(new Blob()); return; }
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      mediaRecorder = null;
      resolve(blob);
    };
    mr.stop();
  });
}

export function cancelMicRecording(): void {
  try { mediaRecorder?.stop(); } catch { /* noop */ }
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  mediaRecorder = null;
  chunks = [];
}
