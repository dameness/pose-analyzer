import { vi } from 'vitest';
import '@testing-library/react';

// Mock MediaRecorder — rastreia a última instância criada
class MockMediaRecorder {
  static _lastInstance: MockMediaRecorder | null = null;
  static isTypeSupported(_type: string) {
    return true;
  }

  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  stream: MediaStream;
  options: MediaRecorderOptions | undefined;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.options = options;
    MockMediaRecorder._lastInstance = this;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }
}

function makeFakeStream(): MediaStream {
  const track = { stop: vi.fn(), kind: 'video' } as unknown as MediaStreamTrack;
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
}

Object.defineProperty(globalThis, 'MediaRecorder', {
  writable: true,
  value: MockMediaRecorder,
});

Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue(makeFakeStream()),
  },
});
