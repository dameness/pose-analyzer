import { useState, useRef, useEffect } from 'react';
import type { VideoRecorderState } from '../types';

const INITIAL_STATE: VideoRecorderState = {
  status: 'idle',
  videoBlob: null,
  videoUrl: null,
  error: null,
};

export function useVideoRecorder(): {
  state: VideoRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
  streamRef: React.RefObject<MediaStream | null>;
} {
  const [state, setState] = useState<VideoRecorderState>(INITIAL_STATE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string | null>(null);

  function cleanup() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null; // detach before onstop fires
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  useEffect(() => () => cleanup(), []);

  async function startRecording(): Promise<void> {
    cleanup();
    chunksRef.current = [];
    setState({ status: 'idle', videoBlob: null, videoUrl: null, error: null });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Permissão para câmera negada. Verifique as configurações do navegador.'
          : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'Nenhuma câmera encontrada neste dispositivo.'
          : 'Não foi possível acessar a câmera.';
      setState(prev => ({ ...prev, error: message }));
      return;
    }

    streamRef.current = stream;
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (mediaRecorderRef.current === null) return; // detached by cleanup — skip to avoid leak
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setState({ status: 'stopped', videoBlob: blob, videoUrl: url, error: null });
    };

    recorder.start();
    setState({ status: 'recording', videoBlob: null, videoUrl: null, error: null });

    timeoutRef.current = setTimeout(() => stopRecording(), 30_000);
  }

  function stopRecording(): void {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  function reset(): void {
    cleanup();
    setState(INITIAL_STATE);
  }

  return { state, startRecording, stopRecording, reset, streamRef };
}
