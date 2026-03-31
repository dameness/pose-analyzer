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
