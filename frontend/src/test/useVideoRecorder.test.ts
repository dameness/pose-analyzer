import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVideoRecorder } from '../hooks/useVideoRecorder';

beforeEach(() => {
  vi.restoreAllMocks();
  // Reinicia o mock do getUserMedia a cada teste
  (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue({
    getTracks: () => [{ stop: vi.fn(), kind: 'video' }],
  } as unknown as MediaStream);
});

describe('useVideoRecorder — pauseRecording', () => {
  it('transiciona para paused ao chamar pauseRecording durante gravação', async () => {
    const { result } = renderHook(() => useVideoRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state.status).toBe('recording');

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.state.status).toBe('paused');
  });

  it('não faz nada se pauseRecording for chamado quando não está gravando', async () => {
    const { result } = renderHook(() => useVideoRecorder());

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.state.status).toBe('idle');
  });
});

describe('useVideoRecorder — resumeRecording', () => {
  it('volta para recording ao chamar resumeRecording após pausa', async () => {
    const { result } = renderHook(() => useVideoRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.state.status).toBe('paused');

    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.state.status).toBe('recording');
  });

  it('não faz nada se resumeRecording for chamado quando não está pausado', async () => {
    const { result } = renderHook(() => useVideoRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.resumeRecording();
    });

    // ainda recording, não mudou
    expect(result.current.state.status).toBe('recording');
  });
});

describe('useVideoRecorder — stopRecording após pausa', () => {
  it('para a gravação e produz blob mesmo se estava pausado', async () => {
    const { result } = renderHook(() => useVideoRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.state.status).toBe('stopped');
  });
});
