"""
Detecção do lado de gravação (esquerdo, direito ou frontal).

Analisa a visibilidade dos keypoints pareados (esquerdo vs direito) ao longo
de múltiplos frames para determinar de qual lado o usuário foi gravado.
Rejeita gravações frontais com ValueError.
"""

from pipeline.postural_checker import (
    COTOVELO_ESQ,
    COTOVELO_DIR,
    JOELHO_ESQ,
    JOELHO_DIR,
    OMBRO_ESQ,
    OMBRO_DIR,
    QUADRIL_ESQ,
    QUADRIL_DIR,
    TORNOZELO_ESQ,
    TORNOZELO_DIR,
)

# ---------------------------------------------------------------------------
# Constantes de configuração
# ---------------------------------------------------------------------------

# Pares de keypoints (esquerdo, direito) para comparação de visibilidade
_PARES_KEYPOINTS = [
    (OMBRO_ESQ, OMBRO_DIR),
    (COTOVELO_ESQ, COTOVELO_DIR),
    (QUADRIL_ESQ, QUADRIL_DIR),
    (JOELHO_ESQ, JOELHO_DIR),
    (TORNOZELO_ESQ, TORNOZELO_DIR),
]

# Limiar para considerar um lado dominante.
# Se a razão média_esq / média_dir > RATIO_LIMIAR, lado esquerdo domina.
# Se < 1/RATIO_LIMIAR, lado direito domina.
# Se entre esses valores, considera-se frontal.
RATIO_LIMIAR = 1.4

# Mínimo de frames válidos para tomar a decisão
_MIN_FRAMES_DETECCAO = 5


# ---------------------------------------------------------------------------
# Função pública
# ---------------------------------------------------------------------------

def detectar_lado(keypoints_por_frame: list[list[dict] | None]) -> str:
    """
    Analisa a visibilidade dos keypoints pareados para determinar
    de qual lado o usuário foi gravado.

    Retorna "left" ou "right".

    Levanta ValueError se a gravação for frontal (visibilidade semelhante
    em ambos os lados) ou se não houver frames suficientes.
    """
    ratios = []

    for keypoints in keypoints_por_frame:
        if keypoints is None:
            continue

        vis_esq = []
        vis_dir = []
        for idx_esq, idx_dir in _PARES_KEYPOINTS:
            vis_esq.append(keypoints[idx_esq]["visibility"])
            vis_dir.append(keypoints[idx_dir]["visibility"])

        media_esq = sum(vis_esq) / len(vis_esq)
        media_dir = sum(vis_dir) / len(vis_dir)

        # Evitar divisão por zero
        if media_dir > 0.01:
            ratios.append(media_esq / media_dir)

    if len(ratios) < _MIN_FRAMES_DETECCAO:
        raise ValueError(
            "Não foi possível detectar o lado da gravação — "
            "poucos frames com pose detectada. "
            "Verifique o enquadramento e tente novamente."
        )

    # Usar mediana para robustez contra outliers
    ratios.sort()
    mediana = ratios[len(ratios) // 2]

    if mediana > RATIO_LIMIAR:
        return "left"
    elif mediana < 1 / RATIO_LIMIAR:
        return "right"
    else:
        raise ValueError(
            "Gravação frontal detectada. "
            "Por favor, grave o vídeo de lado (perfil esquerdo ou direito) "
            "para que a análise postural funcione corretamente."
        )
