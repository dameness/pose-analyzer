"""
Detecção de início de movimento no vídeo.

Analisa a articulação primária de cada exercício e identifica o frame
onde o usuário começa a executar o movimento, descartando frames ociosos
no início da gravação.
"""

from pipeline.angle_calculator import calcular_angulo
from pipeline.postural_checker import (
    COTOVELO_ESQ,
    JOELHO_ESQ,
    OMBRO_ESQ,
    PULSO_ESQ,
    QUADRIL_ESQ,
    TORNOZELO_ESQ,
)

# ---------------------------------------------------------------------------
# Constantes de configuração
# ---------------------------------------------------------------------------

JANELA_SUAVIZACAO = 5         # moving average para filtrar jitter do MediaPipe
FRAMES_CONSECUTIVOS = 5       # frames seguidos com ângulo diminuindo
DELTA_ACUMULADO_MINIMO = 15.0 # graus de variação acumulada mínima na janela
LOOKBACK_FRAMES = 3           # margem antes do ponto detectado

# Articulação primária por exercício — (p1, p2_vertice, p3)
ARTICULACAO_PRIMARIA = {
    "squat":  (QUADRIL_ESQ, JOELHO_ESQ, TORNOZELO_ESQ),
    "pushup": (OMBRO_ESQ, COTOVELO_ESQ, PULSO_ESQ),
    "situp":  (OMBRO_ESQ, QUADRIL_ESQ, JOELHO_ESQ),
}

# Mínimo de frames necessários para tentar a detecção
_MIN_FRAMES = JANELA_SUAVIZACAO + FRAMES_CONSECUTIVOS


# ---------------------------------------------------------------------------
# Funções internas
# ---------------------------------------------------------------------------

def _calcular_angulos_primarios(
    keypoints_por_frame: list,
    exercise: str,
) -> tuple[list[int], list[float]]:
    """
    Calcula o ângulo da articulação primária para cada frame válido.
    Retorna (indices_dos_frames, angulos).
    """
    p1_idx, p2_idx, p3_idx = ARTICULACAO_PRIMARIA[exercise]
    indices = []
    angulos = []

    for i, kps in enumerate(keypoints_por_frame):
        if kps is None:
            continue
        angulo = calcular_angulo(kps[p1_idx], kps[p2_idx], kps[p3_idx])
        indices.append(i)
        angulos.append(angulo)

    return indices, angulos


def _suavizar(valores: list[float], janela: int) -> list[float]:
    """Moving average simples."""
    if len(valores) < janela:
        return list(valores)

    resultado = []
    for i in range(len(valores) - janela + 1):
        media = sum(valores[i : i + janela]) / janela
        resultado.append(media)
    return resultado


def _encontrar_inicio(
    angulos_suavizados: list[float],
    indices_frames: list[int],
    offset_suavizacao: int,
) -> int:
    """
    Percorre a série suavizada com sliding window e encontra o primeiro
    trecho com FRAMES_CONSECUTIVOS deltas negativos cuja queda acumulada
    >= DELTA_ACUMULADO_MINIMO.

    Retorna o índice no vetor original de keypoints, ou 0 se nada encontrado.
    """
    deltas = [
        angulos_suavizados[i + 1] - angulos_suavizados[i]
        for i in range(len(angulos_suavizados) - 1)
    ]

    for i in range(len(deltas) - FRAMES_CONSECUTIVOS + 1):
        janela = deltas[i : i + FRAMES_CONSECUTIVOS]

        if all(d < 0 for d in janela):
            queda_acumulada = abs(sum(janela))
            if queda_acumulada >= DELTA_ACUMULADO_MINIMO:
                # Mapear de volta para índice do frame original
                # i no vetor de deltas corresponde a angulos_suavizados[i],
                # que por sua vez corresponde a indices_frames[i + offset_suavizacao]
                idx_suavizado = i + offset_suavizacao
                if idx_suavizado < len(indices_frames):
                    frame_original = indices_frames[idx_suavizado]
                else:
                    frame_original = indices_frames[-1]
                return max(0, frame_original - LOOKBACK_FRAMES)

    return 0


# ---------------------------------------------------------------------------
# Função pública
# ---------------------------------------------------------------------------

def detectar_inicio_movimento(
    keypoints_por_frame: list,
    exercise: str,
) -> int:
    """
    Retorna o índice do frame onde o movimento do exercício começa.
    Se nenhum movimento for detectado, retorna 0 (usa todos os frames).
    """
    if exercise not in ARTICULACAO_PRIMARIA:
        return 0

    indices, angulos = _calcular_angulos_primarios(keypoints_por_frame, exercise)

    if len(angulos) < _MIN_FRAMES:
        return 0

    # Suavização reduz jitter do MediaPipe
    suavizados = _suavizar(angulos, JANELA_SUAVIZACAO)

    # offset: a suavização "come" (JANELA_SUAVIZACAO - 1) / 2 frames do início
    # mas como é moving average sem centralização, o índice 0 do suavizado
    # corresponde ao índice 0 do original (primeira janela completa)
    offset = 0

    return _encontrar_inicio(suavizados, indices, offset)
