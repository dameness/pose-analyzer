import { useEffect, useRef, useState } from 'react';
import type { VideoRecorderState } from '../types';

function getSupportedMimeType(): string {
  const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

const INITIAL_STATE: VideoRecorderState = {
  status: 'idle',
  videoBlob: null,
  videoUrl: null,
  error: null,
};

export type UseVideoRecorderReturn = {
  state: VideoRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  reset: () => void;
  streamRef: React.RefObject<MediaStream | null>;
};

export function useVideoRecorder(): UseVideoRecorderReturn {
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
      streamRef.current.getTracks().forEach((t) => t.stop());
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

    if (!navigator.mediaDevices?.getUserMedia) {
      setState((prev) => ({
        ...prev,
        error: 'Câmera não disponível. Acesse via HTTPS ou use um navegador compatível.',
      }));
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Permissão para câmera negada. Verifique as configurações do navegador.'
          : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'Nenhuma câmera encontrada neste dispositivo.'
          : err instanceof DOMException && err.name === 'NotSupportedError'
          ? 'Câmera não suportada neste navegador. Tente usar Safari ou Chrome.'
          : 'Não foi possível acessar a câmera.';
      setState((prev) => ({ ...prev, error: message }));
      return;
    }

    streamRef.current = stream;
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (mediaRecorderRef.current === null) return; // detached by cleanup — skip to avoid leak
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
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

  function pauseRecording(): void {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState((prev) => ({ ...prev, status: 'paused' }));
    }
  }

  function resumeRecording(): void {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState((prev) => ({ ...prev, status: 'recording' }));
    }
  }

  function reset(): void {
    cleanup();
    setState(INITIAL_STATE);
  }

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    reset,
    streamRef,
  };
}
