"""
Script standalone — gera uma imagem (PNG) lado a lado ilustrando o efeito da
correção de perspectiva: esqueleto MediaPipe original | esqueleto corrigido,
plotados sobre o mesmo frame de um vídeo.

O frame é escolhido automaticamente como o de maior θ (rotação mais visível),
com override opcional via --frame. O quadril do lado visível (âncora da
correção, que não se move) é destacado.

Uso:
    python scripts/visualizar_correcao_perspectiva.py video.mp4 -o saida.png [--frame 42]
"""

import argparse
import os
import sys

import cv2
import mediapipe as mp
import numpy as np

# Permite rodar o script de qualquer diretório resolvendo os módulos pipeline.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.mediapipe_runner import inicializar_pose, extrair_keypoints
from pipeline.side_detector import detectar_lado
from pipeline.perspective_corrector import (
    corrigir_perspectiva,
    estimar_thetas_por_frame,
)
from pipeline.postural_checker import QUADRIL_ESQ, QUADRIL_DIR

# Conexões do esqueleto MediaPipe Pose
_POSE_CONNECTIONS = mp.solutions.pose.POSE_CONNECTIONS
# Landmarks de face (nariz, olhos, orelhas, boca) — não exibidos
_FACE_LANDMARKS = frozenset(range(11))

# Cores em BGR (OpenCV)
COR_ESQUELETO = (200, 200, 200)  # cinza claro
COR_PIVO      = (0, 215, 255)    # dourado — destaca o quadril-âncora
COR_TITULO    = (255, 255, 255)  # branco

_RAIO_LANDMARK = 4
_RAIO_PIVO     = 9
_ESPESSURA     = 2
_ALTURA_BARRA  = 40


def _desenhar_esqueleto(frame, keypoints, largura, altura, idx_pivo):
    """Desenha o esqueleto neutro (in-place) e destaca o quadril-pivô."""
    for a, b in _POSE_CONNECTIONS:
        if a in _FACE_LANDMARKS or b in _FACE_LANDMARKS:
            continue
        kp_a = keypoints[a]
        kp_b = keypoints[b]
        if kp_a is None or kp_b is None:
            continue
        pt_a = (int(kp_a["x"] * largura), int(kp_a["y"] * altura))
        pt_b = (int(kp_b["x"] * largura), int(kp_b["y"] * altura))
        cv2.line(frame, pt_a, pt_b, COR_ESQUELETO, _ESPESSURA)

    for idx, kp in enumerate(keypoints):
        if kp is None or idx in _FACE_LANDMARKS:
            continue
        centro = (int(kp["x"] * largura), int(kp["y"] * altura))
        cv2.circle(frame, centro, _RAIO_LANDMARK, COR_ESQUELETO, -1)

    kp_pivo = keypoints[idx_pivo]
    if kp_pivo is not None:
        cp = (int(kp_pivo["x"] * largura), int(kp_pivo["y"] * altura))
        cv2.circle(frame, cp, _RAIO_PIVO, COR_PIVO, -1)
        cv2.circle(frame, cp, _RAIO_PIVO + 4, COR_PIVO, 2)


def _adicionar_titulo(frame, texto):
    """Retorna o frame com uma barra de título preta no topo."""
    largura = frame.shape[1]
    barra = np.zeros((_ALTURA_BARRA, largura, 3), dtype=np.uint8)
    cv2.putText(
        barra, texto, (10, 28),
        cv2.FONT_HERSHEY_SIMPLEX, 0.8, COR_TITULO, 2, cv2.LINE_AA,
    )
    return cv2.vconcat([barra, frame])


def _extrair_keypoints_video(video_path):
    """Roda o MediaPipe em todos os frames. Retorna lista de keypoints (ou None)."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    pose = inicializar_pose(static_image_mode=False)
    keypoints_por_frame = []
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            keypoints_por_frame.append(extrair_keypoints(pose.process(rgb)))
    finally:
        pose.close()
        cap.release()
    return keypoints_por_frame


def _ler_frame_bgr(video_path, idx):
    """Reabre o vídeo e lê sequencialmente até o frame idx (robusto a seek de webm)."""
    cap = cv2.VideoCapture(video_path)
    frame_bgr = None
    i = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if i == idx:
            frame_bgr = frame
            break
        i += 1
    cap.release()
    return frame_bgr


def main():
    parser = argparse.ArgumentParser(
        description="Gera PNG lado a lado da correção de perspectiva."
    )
    parser.add_argument("video_path", help="caminho do vídeo de entrada")
    parser.add_argument(
        "-o", "--output", default="visualizacao_correcao.png",
        help="caminho do PNG de saída (default: visualizacao_correcao.png)",
    )
    parser.add_argument(
        "--frame", type=int, default=None,
        help="índice do frame (default: frame de maior θ)",
    )
    args = parser.parse_args()

    keypoints_por_frame = _extrair_keypoints_video(args.video_path)
    if keypoints_por_frame is None:
        print(f"Erro: não foi possível abrir o vídeo '{args.video_path}'.", file=sys.stderr)
        return 1
    if not any(kp is not None for kp in keypoints_por_frame):
        print("Erro: nenhuma pose detectada no vídeo.", file=sys.stderr)
        return 1

    try:
        side = detectar_lado(keypoints_por_frame)
    except ValueError as e:
        print(f"Erro ao detectar o lado da gravação: {e}", file=sys.stderr)
        return 1

    corrigidos = corrigir_perspectiva(keypoints_por_frame, side)
    thetas = estimar_thetas_por_frame(keypoints_por_frame, side)

    if args.frame is not None:
        idx = args.frame
        if (
            not (0 <= idx < len(keypoints_por_frame))
            or keypoints_por_frame[idx] is None
            or thetas[idx] is None
        ):
            print(f"Erro: frame {idx} inválido ou sem pose detectada.", file=sys.stderr)
            return 1
    else:
        indices_validos = [i for i, t in enumerate(thetas) if t is not None]
        if not indices_validos:
            print(
                "Erro: nenhum θ estimado (frames insuficientes para correção de perspectiva).",
                file=sys.stderr,
            )
            return 1
        idx = max(indices_validos, key=lambda i: thetas[i])

    theta_frame = thetas[idx]
    frame_bgr = _ler_frame_bgr(args.video_path, idx)
    if frame_bgr is None:
        print(f"Erro: não foi possível ler o frame {idx}.", file=sys.stderr)
        return 1

    altura, largura = frame_bgr.shape[:2]
    idx_pivo = QUADRIL_ESQ if side == "left" else QUADRIL_DIR

    painel_orig = frame_bgr.copy()
    painel_corr = frame_bgr.copy()
    _desenhar_esqueleto(painel_orig, keypoints_por_frame[idx], largura, altura, idx_pivo)
    _desenhar_esqueleto(painel_corr, corrigidos[idx], largura, altura, idx_pivo)

    painel_orig = _adicionar_titulo(painel_orig, "Original")
    painel_corr = _adicionar_titulo(painel_corr, f"Corrigido - theta={theta_frame:.1f} graus")

    composicao = cv2.hconcat([painel_orig, painel_corr])
    cv2.imwrite(args.output, composicao)
    print(
        f"Imagem salva em '{args.output}' "
        f"(frame {idx}, lado '{side}', theta={theta_frame:.1f} graus)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
