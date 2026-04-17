"""Anotação visual de vídeos com esqueleto MediaPipe e articulações coloridas."""

import av
import cv2
import mediapipe as mp
import numpy as np

from pipeline.angle_calculator import calcular_angulo
from pipeline.postural_checker import (
    KEYPOINTS_POR_LADO,
    NARIZ,
    OMBRO_ESQ, OMBRO_DIR,
    QUADRIL_ESQ, QUADRIL_DIR,
)

# Conexões do esqueleto MediaPipe Pose
_POSE_CONNECTIONS = mp.solutions.pose.POSE_CONNECTIONS

# Cores em formato BGR (OpenCV)
COR_CORRETO   = (0, 200, 0)      # verde
COR_INCORRETO = (0, 0, 220)      # vermelho
COR_NEUTRO    = (180, 180, 180)  # cinza

# Geometria da anotação
_RAIO_LANDMARK   = 5
_RAIO_ANEL       = 14
_ESPESSURA_LINHA = 2
_OFFSET_LABEL    = 60
_FONTE_ANGULO    = cv2.FONT_HERSHEY_SIMPLEX
_ESCALA_FONTE    = 1.5

# Triplas (p1_key, vertex_key, p3_key) usando chaves de KEYPOINTS_POR_LADO
_TRIPLAS_POR_EXERCICIO: dict[str, dict[str, tuple[str, str, str]]] = {
    "squat": {
        "knee":  ("quadril",    "joelho",    "tornozelo"),
        "hip":   ("ombro",      "quadril",   "joelho"),
        "ankle": ("joelho",     "tornozelo", "indice_pe"),
    },
    "pushup": {
        "elbow":    ("ombro",    "cotovelo", "pulso"),
        "shoulder": ("cotovelo", "ombro",    "quadril"),
        "hip":      ("ombro",    "quadril",  "joelho"),
    },
    "situp": {
        "hip": ("ombro", "quadril", "joelho"),
        # "spine" tratado separadamente — usa pontos médios bilaterais
    },
}


def _construir_info_articulacoes(
    exercise: str, side: str, joint_results: dict
) -> list[dict]:
    """
    Retorna lista de dicts por articulação com índices de keypoints e cor.
    Articulações corretas vêm primeiro; incorretas por último para sobrescrever sobreposições.
    Cada dict tem: joint, cor, idx_p1, idx_vertex, idx_p3, bilateral (bool).
    Para situp/spine, bilateral=True com idx_p1=NARIZ e vértice/p3 calculados como midpoints.
    """
    kp = KEYPOINTS_POR_LADO[side]
    triplas = _TRIPLAS_POR_EXERCICIO.get(exercise, {})
    infos = []

    for joint, (k1, kv, k3) in triplas.items():
        resultado = joint_results.get(joint)
        if resultado is None:
            continue
        cor = COR_CORRETO if resultado == "correct" else COR_INCORRETO
        infos.append({
            "joint":      joint,
            "cor":        cor,
            "idx_p1":     kp[k1],
            "idx_vertex": kp[kv],
            "idx_p3":     kp[k3],
            "bilateral":  False,
        })

    # Caso especial: situp/spine usa pontos médios bilaterais
    if exercise == "situp" and "spine" in joint_results:
        resultado = joint_results["spine"]
        cor = COR_CORRETO if resultado == "correct" else COR_INCORRETO
        infos.append({
            "joint":      "spine",
            "cor":        cor,
            "idx_p1":     NARIZ,
            "idx_vertex": (OMBRO_ESQ, OMBRO_DIR),   # tupla indica midpoint
            "idx_p3":     (QUADRIL_ESQ, QUADRIL_DIR),
            "bilateral":  True,
        })

    # Corretas primeiro, incorretas por último
    infos.sort(key=lambda x: 0 if x["cor"] == COR_CORRETO else 1)
    return infos


def _resolver_ponto(idx, keypoints: list[dict], largura: int, altura: int):
    """
    Converte índice(s) de landmark em coordenada de pixel.
    Se idx for tupla, retorna o ponto médio dos dois landmarks.
    Retorna None se algum keypoint for None.
    """
    if isinstance(idx, tuple):
        kp_a = keypoints[idx[0]]
        kp_b = keypoints[idx[1]]
        if kp_a is None or kp_b is None:
            return None
        x = int(((kp_a["x"] + kp_b["x"]) / 2) * largura)
        y = int(((kp_a["y"] + kp_b["y"]) / 2) * altura)
        return (x, y)
    kp = keypoints[idx]
    if kp is None:
        return None
    return (int(kp["x"] * largura), int(kp["y"] * altura))


def _calcular_angulo_frame(info: dict, keypoints: list[dict]) -> float | None:
    """Calcula o ângulo da articulação no frame atual."""
    if info["bilateral"]:
        idx_v = info["idx_vertex"]
        idx_p3 = info["idx_p3"]
        kp_p1     = keypoints[info["idx_p1"]]
        kp_v_esq  = keypoints[idx_v[0]]
        kp_v_dir  = keypoints[idx_v[1]]
        kp_p3_esq = keypoints[idx_p3[0]]
        kp_p3_dir = keypoints[idx_p3[1]]
        if any(k is None for k in [kp_p1, kp_v_esq, kp_v_dir, kp_p3_esq, kp_p3_dir]):
            return None
        kp_vertex = {
            "x": (kp_v_esq["x"] + kp_v_dir["x"]) / 2,
            "y": (kp_v_esq["y"] + kp_v_dir["y"]) / 2,
        }
        kp_p3 = {
            "x": (kp_p3_esq["x"] + kp_p3_dir["x"]) / 2,
            "y": (kp_p3_esq["y"] + kp_p3_dir["y"]) / 2,
        }
        return calcular_angulo(kp_p1, kp_vertex, kp_p3)
    else:
        kp_p1 = keypoints[info["idx_p1"]]
        kp_v  = keypoints[info["idx_vertex"]]
        kp_p3 = keypoints[info["idx_p3"]]
        if kp_p1 is None or kp_v is None or kp_p3 is None:
            return None
        return calcular_angulo(kp_p1, kp_v, kp_p3)


def anotar_video(
    video_path: str,
    keypoints_completos: list,
    joint_results: dict,
    exercise: str,
    fps: float,
    frame_inicio: int,
    frame_fim: int,
    output_path: str,
    side: str = "left",
    keypoints_para_angulos: list | None = None,
) -> None:
    """
    Lê o vídeo original e grava uma versão anotada com o esqueleto MediaPipe.

    Frames dentro de [frame_inicio, frame_fim) recebem coloração baseada em joint_results.
    Frames fora do intervalo são copiados sem anotação.
    Frames sem keypoints detectados são copiados sem anotação.
    """
    cap = cv2.VideoCapture(video_path)
    largura = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    altura  = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # WebM from browsers sometimes reports 0 dimensions via metadata; read a frame to get real size
    if largura == 0 or altura == 0:
        ret, primeiro_frame = cap.read()
        if ret:
            altura, largura = primeiro_frame.shape[:2]
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    # yuv420p requires even dimensions; crop 1px if odd (libx264 fails otherwise)
    largura_enc = largura - (largura % 2)
    altura_enc  = altura  - (altura  % 2)

    infos_articulacoes = _construir_info_articulacoes(exercise, side, joint_results)

    # PyAV's average_rate reads actual fps from the container — OpenCV's CAP_PROP_FPS
    # misreads the WebM millisecond timebase as 1000fps, causing accelerated output
    with av.open(video_path) as _c:
        _vs = _c.streams.video[0]
        _rate = float(_vs.average_rate or _vs.guessed_rate or 0)
    fps_enc = int(round(_rate)) if 1 <= _rate <= 120 else (int(fps) if 1 <= fps <= 120 else 30)

    container = av.open(output_path, mode="w")
    stream = container.add_stream("h264", rate=fps_enc)
    stream.width  = largura_enc
    stream.height = altura_enc
    stream.pix_fmt = "yuv420p"

    try:
        i = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            keypoints = keypoints_completos[i] if i < len(keypoints_completos) else None
            kp_angulo = (
                keypoints_para_angulos[i]
                if keypoints_para_angulos is not None and i < len(keypoints_para_angulos)
                else keypoints
            )

            if keypoints is not None and frame_inicio <= i < frame_fim:
                _anotar_frame(frame, keypoints, kp_angulo, infos_articulacoes, largura, altura)

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            # Crop to even dimensions if needed
            frame_rgb = frame_rgb[:altura_enc, :largura_enc]
            av_frame = av.VideoFrame.from_ndarray(frame_rgb, format="rgb24")
            av_frame.pts = i
            for packet in stream.encode(av_frame):
                container.mux(packet)

            i += 1

        for packet in stream.encode():
            container.mux(packet)
    finally:
        cap.release()
        container.close()


def _anotar_frame(
    frame,
    keypoints: list[dict],
    keypoints_angulo: list[dict],
    infos_articulacoes: list[dict],
    largura: int,
    altura: int,
) -> None:
    """
    Desenha sobre o frame (in-place):
    1. Arestas neutras (POSE_CONNECTIONS não cobertas por nenhuma articulação)
    2. Arestas das articulações corretas (ambas as pernas do ângulo)
    3. Arestas das articulações incorretas (sobrescrevem sobreposições)
    4. Landmarks neutros
    5. Anéis coloridos + pontos internos no vértice
    6. Labels de ângulo com offset perpendicular
    """
    # Montar mapa de arestas coloridas: frozenset({a,b}) → cor
    # Corretas primeiro, incorretas sobrescrevem (infos já ordenadas)
    arestas_coloridas: dict[frozenset, tuple] = {}
    for info in infos_articulacoes:
        if info["bilateral"]:
            continue  # arestas bilaterais (spine) não mapeiam para POSE_CONNECTIONS
        cor = info["cor"]
        v   = info["idx_vertex"]
        p1  = info["idx_p1"]
        p3  = info["idx_p3"]
        arestas_coloridas[frozenset({p1, v})] = cor
        arestas_coloridas[frozenset({v, p3})] = cor

    # 1+2+3 — Desenhar todas as conexões do esqueleto
    for a, b in _POSE_CONNECTIONS:
        if a >= len(keypoints) or b >= len(keypoints):
            continue
        kp_a = keypoints[a]
        kp_b = keypoints[b]
        if kp_a is None or kp_b is None:
            continue
        cor = arestas_coloridas.get(frozenset({a, b}), COR_NEUTRO)
        pt_a = (int(kp_a["x"] * largura), int(kp_a["y"] * altura))
        pt_b = (int(kp_b["x"] * largura), int(kp_b["y"] * altura))
        cv2.line(frame, pt_a, pt_b, cor, _ESPESSURA_LINHA)

    # 4 — Landmarks neutros (referência visual)
    for kp in keypoints:
        if kp is None:
            continue
        cx = int(kp["x"] * largura)
        cy = int(kp["y"] * altura)
        cv2.circle(frame, (cx, cy), _RAIO_LANDMARK, COR_NEUTRO, -1)

    # 5+6 — Anéis, pontos internos e labels por articulação
    for info in infos_articulacoes:
        cor    = info["cor"]
        pt_v   = _resolver_ponto(info["idx_vertex"], keypoints, largura, altura)
        pt_p1  = _resolver_ponto(info["idx_p1"],     keypoints, largura, altura)
        pt_p3  = _resolver_ponto(info["idx_p3"],     keypoints, largura, altura)

        if pt_v is None or pt_p1 is None or pt_p3 is None:
            continue

        espessura_anel = 3 if cor == COR_INCORRETO else 2
        cv2.circle(frame, pt_v, _RAIO_ANEL, cor, espessura_anel)
        cv2.circle(frame, pt_v, _RAIO_LANDMARK, cor, -1)

        angulo = _calcular_angulo_frame(info, keypoints_angulo)
        if angulo is None:
            continue

        # Offset perpendicular à linha p1→p3
        dx = pt_p3[0] - pt_p1[0]
        dy = pt_p3[1] - pt_p1[1]
        norm = (dx**2 + dy**2) ** 0.5
        if norm < 1:
            continue
        perp_x = -dy / norm
        perp_y =  dx / norm
        lx = int(pt_v[0] + _OFFSET_LABEL * perp_x)
        ly = int(pt_v[1] + _OFFSET_LABEL * perp_y)

        texto = f"{angulo:.0f}"
        cv2.putText(frame, texto, (lx, ly), _FONTE_ANGULO, _ESCALA_FONTE, cor, 6, cv2.LINE_AA)
        # Círculo pequeno simulando o símbolo de grau (OpenCV não suporta Unicode)
        (tw, th), _ = cv2.getTextSize(texto, _FONTE_ANGULO, _ESCALA_FONTE, 6)
        raio_grau = 5
        cx_grau = lx + tw + raio_grau + 1
        cy_grau = ly - th + raio_grau
        cv2.circle(frame, (cx_grau, cy_grau), raio_grau, cor, 5)
