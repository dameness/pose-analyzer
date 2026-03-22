"""Anotação visual de vídeos com esqueleto MediaPipe e articulações coloridas."""

import av
import cv2
import mediapipe as mp
import numpy as np

# Conexões do esqueleto MediaPipe Pose
_POSE_CONNECTIONS = mp.solutions.pose.POSE_CONNECTIONS

# Cores em formato BGR (OpenCV)
COR_CORRETO   = (0, 200, 0)      # verde
COR_INCORRETO = (0, 0, 220)      # vermelho
COR_NEUTRO    = (180, 180, 180)  # cinza

# Raio dos círculos e espessura das linhas
_RAIO_LANDMARK  = 5
_ESPESSURA_LINHA = 2

# Mapeamento articulação (chave da API) → índices de landmark MediaPipe por exercício
_LANDMARKS_POR_ARTICULACAO: dict[str, dict[str, list[int]]] = {
    "squat": {
        "knee":   [25, 26],
        "hip":    [23, 24],
        "ankle":  [27, 28, 31, 32],
    },
    "pushup": {
        "elbow":    [13, 14],
        "shoulder": [11, 12],
        "hip":      [23, 24],
    },
    "situp": {
        "hip":   [23, 24],
        "spine": [0, 11, 12, 23, 24],
    },
}


def _construir_mapa_cor(exercise: str, joint_results: dict) -> dict[int, tuple]:
    """
    Retorna um dict mapeando índice de landmark → cor BGR,
    baseado nos resultados posturais de cada articulação.
    Landmarks não mapeados ao exercício não aparecem no dict (usar COR_NEUTRO como fallback).
    """
    mapa: dict[int, tuple] = {}
    articulacoes = _LANDMARKS_POR_ARTICULACAO.get(exercise, {})
    for articulacao, indices in articulacoes.items():
        resultado = joint_results.get(articulacao)
        if resultado is None:
            continue
        cor = COR_CORRETO if resultado == "correct" else COR_INCORRETO
        for idx in indices:
            if idx not in mapa:  # articulação mais específica tem prioridade
                mapa[idx] = cor
    return mapa


def anotar_video(
    video_path: str,
    keypoints_completos: list,
    joint_results: dict,
    exercise: str,
    fps: float,
    frame_inicio: int,
    frame_fim: int,
    output_path: str,
) -> None:
    """
    Lê o vídeo original e grava uma versão anotada com o esqueleto MediaPipe.

    Frames dentro de [frame_inicio, frame_fim) recebem coloração baseada em joint_results.
    Frames fora do intervalo recebem o esqueleto em COR_NEUTRO.
    Frames sem keypoints detectados são copiados sem anotação.
    """
    cap = cv2.VideoCapture(video_path)
    largura = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    altura  = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    mapa_cor_ativo = _construir_mapa_cor(exercise, joint_results)

    container = av.open(output_path, mode="w")
    stream = container.add_stream("h264", rate=int(fps))
    stream.width  = largura
    stream.height = altura
    stream.pix_fmt = "yuv420p"

    try:
        i = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            keypoints = keypoints_completos[i] if i < len(keypoints_completos) else None

            if keypoints is not None:
                dentro_intervalo = frame_inicio <= i < frame_fim
                mapa = mapa_cor_ativo if dentro_intervalo else {}
                _desenhar_esqueleto(frame, keypoints, mapa, largura, altura)

            # Converter BGR → RGB e empacotar como frame H.264
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            av_frame = av.VideoFrame.from_ndarray(frame_rgb, format="rgb24")
            av_frame.pts = i
            for packet in stream.encode(av_frame):
                container.mux(packet)

            i += 1

        # Flush do encoder
        for packet in stream.encode():
            container.mux(packet)
    finally:
        cap.release()
        container.close()


def _desenhar_esqueleto(
    frame,
    keypoints: list[dict],
    mapa_cor: dict[int, tuple],
    largura: int,
    altura: int,
) -> None:
    """Desenha conexões e landmarks sobre o frame (in-place)."""
    # Desenhar conexões primeiro (ficam abaixo dos landmarks)
    for a, b in _POSE_CONNECTIONS:
        if a >= len(keypoints) or b >= len(keypoints):
            continue
        kp_a = keypoints[a]
        kp_b = keypoints[b]
        if kp_a is None or kp_b is None:
            continue
        cor = mapa_cor.get(a, COR_NEUTRO)
        pt_a = (int(kp_a["x"] * largura), int(kp_a["y"] * altura))
        pt_b = (int(kp_b["x"] * largura), int(kp_b["y"] * altura))
        cv2.line(frame, pt_a, pt_b, cor, _ESPESSURA_LINHA)

    # Desenhar landmarks
    for idx, kp in enumerate(keypoints):
        if kp is None:
            continue
        cor = mapa_cor.get(idx, COR_NEUTRO)
        cx = int(kp["x"] * largura)
        cy = int(kp["y"] * altura)
        cv2.circle(frame, (cx, cy), _RAIO_LANDMARK, cor, -1)
