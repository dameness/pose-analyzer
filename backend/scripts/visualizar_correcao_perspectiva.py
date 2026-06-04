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
COR_ESQUELETO = (200, 200, 200)  # cinza claro — esqueleto sobre o frame original
COR_VERMELHO  = (0, 0, 255)      # vermelho — esqueleto corrigido sobre fundo branco
COR_PIVO      = (0, 215, 255)    # dourado — destaca o quadril-âncora
COR_TITULO    = (255, 255, 255)  # branco
COR_FUNDO     = (255, 255, 255)  # branco — fundo do painel corrigido
COR_DESLOC    = (0, 255, 255)    # amarelo — vetores de deslocamento (modo sobreposto)

# Deslocamento mínimo (em px) para desenhar um vetor no modo sobreposto
_DESLOC_MINIMO_PX = 3

_RAIO_LANDMARK = 4
_RAIO_PIVO     = 9
_ESPESSURA     = 2
_ALTURA_BARRA  = 40

# Seleção automática de frame: entre os frames com θ "elevado" (>= este fator
# do θ máximo), escolhe o mais próximo do meio da execução — evita frames de
# transição nas pontas e dá um quadro representativo do movimento.
_FATOR_THETA_ELEVADO = 0.95


def _desenhar_esqueleto(frame, keypoints, largura, altura, idx_pivo, cor=COR_ESQUELETO):
    """Desenha o esqueleto (in-place) na cor dada e destaca o quadril-pivô."""
    for a, b in _POSE_CONNECTIONS:
        if a in _FACE_LANDMARKS or b in _FACE_LANDMARKS:
            continue
        kp_a = keypoints[a]
        kp_b = keypoints[b]
        if kp_a is None or kp_b is None:
            continue
        pt_a = (int(kp_a["x"] * largura), int(kp_a["y"] * altura))
        pt_b = (int(kp_b["x"] * largura), int(kp_b["y"] * altura))
        cv2.line(frame, pt_a, pt_b, cor, _ESPESSURA)

    for idx, kp in enumerate(keypoints):
        if kp is None or idx in _FACE_LANDMARKS:
            continue
        centro = (int(kp["x"] * largura), int(kp["y"] * altura))
        cv2.circle(frame, centro, _RAIO_LANDMARK, cor, -1)

    kp_pivo = keypoints[idx_pivo]
    if kp_pivo is not None:
        cp = (int(kp_pivo["x"] * largura), int(kp_pivo["y"] * altura))
        cv2.circle(frame, cp, _RAIO_PIVO, COR_PIVO, -1)
        cv2.circle(frame, cp, _RAIO_PIVO + 4, COR_PIVO, 2)


def _desenhar_deslocamentos(frame, kp_orig, kp_corr, largura, altura):
    """
    Desenha (in-place) um vetor amarelo de cada landmark original até sua
    posição corrigida — torna visível o quanto a correção moveu cada ponto.
    Ignora face e deslocamentos desprezíveis (ex: o quadril-pivô, que não move).
    """
    for idx in range(len(kp_orig)):
        if idx in _FACE_LANDMARKS:
            continue
        a = kp_orig[idx]
        b = kp_corr[idx]
        if a is None or b is None:
            continue
        pa = (int(a["x"] * largura), int(a["y"] * altura))
        pb = (int(b["x"] * largura), int(b["y"] * altura))
        if abs(pa[0] - pb[0]) + abs(pa[1] - pb[1]) < _DESLOC_MINIMO_PX:
            continue
        cv2.line(frame, pa, pb, COR_DESLOC, _ESPESSURA, cv2.LINE_AA)


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
    # Aplica a orientação do metadata (ex: vídeos de celular em retrato)
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
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
    # Mesma orientação aplicada na extração de keypoints — mantém consistência
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
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
    parser.add_argument(
        "--lado", choices=["left", "right"], default=None,
        help=(
            "força o lado e pula a detecção de frontal — útil só para visualizar "
            "vídeos quase-frontais. Padrão: detecta automaticamente."
        ),
    )
    parser.add_argument(
        "--sobreposto", action="store_true",
        help=(
            "desenha original (cinza) e corrigido (vermelho) no MESMO frame, com "
            "vetores de deslocamento. Padrão: dois painéis lado a lado."
        ),
    )
    args = parser.parse_args()

    keypoints_por_frame = _extrair_keypoints_video(args.video_path)
    if keypoints_por_frame is None:
        print(f"Erro: não foi possível abrir o vídeo '{args.video_path}'.", file=sys.stderr)
        return 1
    if not any(kp is not None for kp in keypoints_por_frame):
        print("Erro: nenhuma pose detectada no vídeo.", file=sys.stderr)
        return 1

    if args.lado is not None:
        side = args.lado
    else:
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
        # Entre os frames com θ elevado, escolhe o mais próximo do meio da execução
        theta_max = max(thetas[i] for i in indices_validos)
        candidatos = [
            i for i in indices_validos if thetas[i] >= _FATOR_THETA_ELEVADO * theta_max
        ]
        meio = indices_validos[len(indices_validos) // 2]
        idx = min(candidatos, key=lambda i: abs(i - meio))

    theta_frame = thetas[idx]
    frame_bgr = _ler_frame_bgr(args.video_path, idx)
    if frame_bgr is None:
        print(f"Erro: não foi possível ler o frame {idx}.", file=sys.stderr)
        return 1

    altura, largura = frame_bgr.shape[:2]
    idx_pivo = QUADRIL_ESQ if side == "left" else QUADRIL_DIR

    if args.sobreposto:
        # Modo sobreposto: original (cinza) + corrigido (vermelho) no mesmo frame,
        # com vetores amarelos mostrando o deslocamento de cada ponto.
        painel = frame_bgr.copy()
        _desenhar_esqueleto(painel, keypoints_por_frame[idx], largura, altura, idx_pivo)
        _desenhar_deslocamentos(
            painel, keypoints_por_frame[idx], corrigidos[idx], largura, altura
        )
        _desenhar_esqueleto(
            painel, corrigidos[idx], largura, altura, idx_pivo, cor=COR_VERMELHO
        )
        composicao = _adicionar_titulo(
            painel,
            f"Cinza=original  Vermelho=corrigido  Amarelo=deslocamento "
            f"(theta={theta_frame:.1f} graus)",
        )
    else:
        # Painel original: esqueleto cinza sobre o frame real
        painel_orig = frame_bgr.copy()
        _desenhar_esqueleto(painel_orig, keypoints_por_frame[idx], largura, altura, idx_pivo)

        # Painel corrigido: esqueleto vermelho sobre fundo branco
        painel_corr = np.full((altura, largura, 3), COR_FUNDO, dtype=np.uint8)
        _desenhar_esqueleto(
            painel_corr, corrigidos[idx], largura, altura, idx_pivo, cor=COR_VERMELHO
        )

        painel_orig = _adicionar_titulo(painel_orig, "Original")
        painel_corr = _adicionar_titulo(
            painel_corr, f"Corrigido - theta={theta_frame:.1f} graus"
        )
        composicao = cv2.hconcat([painel_orig, painel_corr])

    cv2.imwrite(args.output, composicao)
    print(
        f"Imagem salva em '{args.output}' "
        f"(frame {idx}, lado '{side}', theta={theta_frame:.1f} graus)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
