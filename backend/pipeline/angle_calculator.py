import numpy as np


def calcular_angulo(p1: dict, p2: dict, p3: dict) -> float:
    """
    Calcula o ângulo em graus na articulação p2 (vértice),
    formado pelos segmentos p2->p1 e p2->p3.

    Recebe três keypoints no formato {"x": float, "y": float, ...}.
    Usa apenas x e y (análise 2D).
    """
    a = np.array([p1["x"], p1["y"]])
    b = np.array([p2["x"], p2["y"]])
    c = np.array([p3["x"], p3["y"]])

    ab = a - b
    cb = c - b

    cos = np.dot(ab, cb) / (np.linalg.norm(ab) * np.linalg.norm(cb))
    cos = np.clip(cos, -1.0, 1.0)  # evita erro de domínio no arccos por imprecisão float

    return float(np.degrees(np.arccos(cos)))
