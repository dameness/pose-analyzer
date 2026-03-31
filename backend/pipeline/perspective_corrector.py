"""
Correção de perspectiva — ajusta coordenadas X dos keypoints para compensar
rotação parcial do corpo em relação à câmera.

Estima o ângulo de rotação (θ) combinando dois sinais:
- Z-based: diferença de profundidade entre keypoints pareados
- X-separation: separação horizontal entre ombros/quadris

Corrige X via x_corrected = x_center + (x - x_center) / cos(θ),
ancorado no quadril do lado mais visível.
"""

import math

import numpy as np

from pipeline.postural_checker import (
    OMBRO_ESQ,
    OMBRO_DIR,
    COTOVELO_ESQ,
    COTOVELO_DIR,
    QUADRIL_ESQ,
    QUADRIL_DIR,
    JOELHO_ESQ,
    JOELHO_DIR,
    TORNOZELO_ESQ,
    TORNOZELO_DIR,
)

# ---------------------------------------------------------------------------
# Constantes configuráveis
# ---------------------------------------------------------------------------

ALPHA_EMA = 0.3
THETA_MAXIMO = math.radians(35)
RATIO_LARGURA_OMBRO = 0.55
RATIO_LARGURA_QUADRIL = 0.45
FATOR_RUIDO_Z = 10.0

# Keypoints pareados para cálculo de ruído Z
_PARES_NEAR = {
    "left": [OMBRO_ESQ, COTOVELO_ESQ, QUADRIL_ESQ, JOELHO_ESQ, TORNOZELO_ESQ],
    "right": [OMBRO_DIR, COTOVELO_DIR, QUADRIL_DIR, JOELHO_DIR, TORNOZELO_DIR],
}

# Mapeamento lado → índices de quadril e ombro (near/far)
_INDICES = {
    "left": {
        "hip_near": QUADRIL_ESQ,
        "hip_far": QUADRIL_DIR,
        "shoulder_near": OMBRO_ESQ,
        "shoulder_far": OMBRO_DIR,
    },
    "right": {
        "hip_near": QUADRIL_DIR,
        "hip_far": QUADRIL_ESQ,
        "shoulder_near": OMBRO_DIR,
        "shoulder_far": OMBRO_ESQ,
    },
}


# ---------------------------------------------------------------------------
# Funções internas de estimação
# ---------------------------------------------------------------------------


def _estimar_theta_z(hip_near_z: float, hip_far_z: float, body_width: float) -> float:
    """Estima θ a partir da diferença de Z entre quadris."""
    if body_width < 1e-6:
        return 0.0
    return math.atan2(hip_near_z - hip_far_z, body_width)


def _estimar_theta_x(separacao_x: float, ref_shoulder_width: float) -> float:
    """Estima θ a partir da separação horizontal dos ombros."""
    if ref_shoulder_width < 1e-6:
        return 0.0
    ratio = np.clip(separacao_x / ref_shoulder_width, -1.0, 1.0)
    return float(math.asin(ratio))


def _calcular_confianca_z(z_noise: float) -> float:
    """Retorna confiança em Z (0-1) inversamente proporcional ao ruído."""
    return 1.0 / (1.0 + z_noise * FATOR_RUIDO_Z)


def _estimar_theta_frame(keypoints: list[dict], side: str) -> float:
    """
    Estima o ângulo de rotação θ para um único frame.
    Combina θ_z (baseado em Z) e θ_x (separação X) ponderados pela
    confiança no sinal Z.
    Retorna 0.0 se o frame for degenerado (torso height ≈ 0).
    """
    idx = _INDICES[side]

    shoulder_near = keypoints[idx["shoulder_near"]]
    hip_near = keypoints[idx["hip_near"]]
    hip_far = keypoints[idx["hip_far"]]
    shoulder_far = keypoints[idx["shoulder_far"]]

    torso_height = abs(shoulder_near["y"] - hip_near["y"])
    if torso_height < 1e-6:
        return 0.0

    body_width = torso_height * RATIO_LARGURA_QUADRIL
    ref_shoulder_width = torso_height * RATIO_LARGURA_OMBRO

    # Sinal A — Z
    theta_z = _estimar_theta_z(hip_near["z"], hip_far["z"], body_width)

    # Sinal B — X separation
    separacao_x = abs(shoulder_near["x"] - shoulder_far["x"])
    theta_x = _estimar_theta_x(separacao_x, ref_shoulder_width)

    # Ruído Z dos keypoints do near side
    near_indices = _PARES_NEAR[side]
    z_values = [keypoints[i]["z"] for i in near_indices]
    z_noise = float(np.std(z_values))

    # Blend ponderado
    z_conf = _calcular_confianca_z(z_noise)
    theta_raw = z_conf * abs(theta_z) + (1.0 - z_conf) * theta_x

    return max(theta_raw, 0.0)


def _aplicar_ema(thetas_raw: list[float]) -> list[float]:
    """Aplica suavização EMA (exponential moving average) na sequência de θ."""
    if not thetas_raw:
        return []

    smoothed = [thetas_raw[0]]
    for i in range(1, len(thetas_raw)):
        s = ALPHA_EMA * thetas_raw[i] + (1.0 - ALPHA_EMA) * smoothed[i - 1]
        smoothed.append(s)

    return smoothed


# ---------------------------------------------------------------------------
# Função pública — corrige perspectiva de uma sequência de frames
# ---------------------------------------------------------------------------


def corrigir_perspectiva(
    keypoints_por_frame: list[list[dict] | None],
    side: str,
) -> list[list[dict] | None]:
    """
    Corrige a perspectiva dos keypoints para compensar rotação parcial
    do corpo em relação à câmera.

    Retorna uma nova lista com X corrigido. Não altera a original.
    Frames None passam sem alteração.
    """
    idx = _INDICES[side]
    hip_near_idx = idx["hip_near"]

    # Passo 1: estimar θ_raw para cada frame válido
    thetas_raw = []
    valid_indices = []
    for i, keypoints in enumerate(keypoints_por_frame):
        if keypoints is None:
            continue
        theta = _estimar_theta_frame(keypoints, side)
        thetas_raw.append(theta)
        valid_indices.append(i)

    if not thetas_raw:
        return list(keypoints_por_frame)

    # Passo 2: suavizar com EMA
    thetas_smoothed = _aplicar_ema(thetas_raw)

    # Passo 3: clampar
    thetas_clamped = [max(0.0, min(t, THETA_MAXIMO)) for t in thetas_smoothed]

    # Passo 4: corrigir X para cada frame válido
    theta_map = dict(zip(valid_indices, thetas_clamped))
    resultado = []

    for i, keypoints in enumerate(keypoints_por_frame):
        if keypoints is None:
            resultado.append(None)
            continue

        theta = theta_map[i]
        cos_theta = math.cos(theta)

        if cos_theta < 1e-6:
            resultado.append([dict(kp) for kp in keypoints])
            continue

        x_center = keypoints[hip_near_idx]["x"]

        frame_corrigido = []
        for kp in keypoints:
            novo_kp = dict(kp)
            novo_kp["x"] = x_center + (kp["x"] - x_center) / cos_theta
            frame_corrigido.append(novo_kp)

        resultado.append(frame_corrigido)

    return resultado
