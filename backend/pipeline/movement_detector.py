"""
Detecção de início e fim de movimento no vídeo.

Analisa a articulação primária de cada exercício e identifica os frames
onde o usuário começa e para de executar o movimento, descartando frames
ociosos no início e no final da gravação.
"""

from pipeline.angle_calculator import calcular_angulo
from pipeline.postural_checker import KEYPOINTS_POR_LADO

# ---------------------------------------------------------------------------
# Constantes de configuração
# ---------------------------------------------------------------------------

JANELA_SUAVIZACAO = 5         # moving average para filtrar jitter do MediaPipe
FRAMES_CONSECUTIVOS = 5       # frames seguidos com ângulo diminuindo
DELTA_ACUMULADO_MINIMO = 15.0 # graus de variação acumulada mínima na janela
LOOKBACK_FRAMES = 3           # margem antes do ponto detectado

def _articulacao_primaria(exercise: str, side: str = "left") -> tuple[int, int, int]:
    """Retorna os índices (p1, p2_vertice, p3) da articulação primária do exercício."""
    kp = KEYPOINTS_POR_LADO[side]
    mapa = {
        "squat":  (kp["quadril"],  kp["joelho"],   kp["tornozelo"]),
        "pushup": (kp["ombro"],    kp["cotovelo"], kp["pulso"]),
        "situp":  (kp["ombro"],    kp["quadril"],  kp["joelho"]),
    }
    return mapa[exercise]

# Mínimo de frames necessários para tentar a detecção
_MIN_FRAMES = JANELA_SUAVIZACAO + FRAMES_CONSECUTIVOS


# ---------------------------------------------------------------------------
# Funções internas
# ---------------------------------------------------------------------------

def _calcular_angulos_primarios(
    keypoints_por_frame: list,
    exercise: str,
    side: str = "left",
) -> tuple[list[int], list[float]]:
    """
    Calcula o ângulo da articulação primária para cada frame válido.
    Retorna (indices_dos_frames, angulos).
    """
    p1_idx, p2_idx, p3_idx = _articulacao_primaria(exercise, side)
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


def _calcular_deltas(angulos_suavizados: list[float]) -> list[float]:
    """Calcula deltas frame-a-frame da série suavizada."""
    return [
        angulos_suavizados[i + 1] - angulos_suavizados[i]
        for i in range(len(angulos_suavizados) - 1)
    ]


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
    deltas = _calcular_deltas(angulos_suavizados)

    for i in range(len(deltas) - FRAMES_CONSECUTIVOS + 1):
        janela = deltas[i : i + FRAMES_CONSECUTIVOS]

        if all(d < 0 for d in janela):
            queda_acumulada = abs(sum(janela))
            if queda_acumulada >= DELTA_ACUMULADO_MINIMO:
                idx_suavizado = i + offset_suavizacao
                if idx_suavizado < len(indices_frames):
                    frame_original = indices_frames[idx_suavizado]
                else:
                    frame_original = indices_frames[-1]
                return max(0, frame_original - LOOKBACK_FRAMES)

    return 0


def _encontrar_fim(
    angulos_suavizados: list[float],
    indices_frames: list[int],
) -> int | None:
    """
    Percorre a série suavizada de trás para frente e encontra o último
    trecho com FRAMES_CONSECUTIVOS deltas significativos (positivos ou
    negativos), indicando que o exercício ainda está em andamento.

    Retorna o índice (exclusivo) no vetor original de keypoints onde o
    movimento termina, ou None se nenhum idle final for detectado.
    """
    deltas = _calcular_deltas(angulos_suavizados)

    # Percorrer janelas de trás para frente
    for i in range(len(deltas) - FRAMES_CONSECUTIVOS, -1, -1):
        janela = deltas[i : i + FRAMES_CONSECUTIVOS]

        variacao_acumulada = sum(abs(d) for d in janela)
        if variacao_acumulada >= DELTA_ACUMULADO_MINIMO:
            # Esta janela ainda tem movimento significativo.
            # O fim do movimento é o final desta janela + margem.
            idx_fim = i + FRAMES_CONSECUTIVOS
            if idx_fim < len(indices_frames):
                frame_original = indices_frames[idx_fim]
            else:
                frame_original = indices_frames[-1]
            return min(len(indices_frames), frame_original + LOOKBACK_FRAMES + 1)

    return None


# ---------------------------------------------------------------------------
# Função pública
# ---------------------------------------------------------------------------

def detectar_inicio_movimento(
    keypoints_por_frame: list,
    exercise: str,
    side: str = "left",
) -> int:
    """
    Retorna o índice do frame onde o movimento do exercício começa.
    Se nenhum movimento for detectado, retorna 0 (usa todos os frames).
    """
    if exercise not in ("squat", "pushup", "situp"):
        return 0

    indices, angulos = _calcular_angulos_primarios(keypoints_por_frame, exercise, side)

    if len(angulos) < _MIN_FRAMES:
        return 0

    # Suavização reduz jitter do MediaPipe
    suavizados = _suavizar(angulos, JANELA_SUAVIZACAO)

    # offset: a suavização "come" (JANELA_SUAVIZACAO - 1) / 2 frames do início
    # mas como é moving average sem centralização, o índice 0 do suavizado
    # corresponde ao índice 0 do original (primeira janela completa)
    offset = 0

    return _encontrar_inicio(suavizados, indices, offset)


def detectar_fim_movimento(
    keypoints_por_frame: list,
    exercise: str,
    side: str = "left",
) -> int:
    """
    Retorna o índice (exclusivo) do último frame relevante do exercício.
    Frames após esse índice são ociosos e podem ser descartados.
    Se nenhum período ocioso for detectado no final, retorna len(keypoints_por_frame).
    """
    total = len(keypoints_por_frame)

    if exercise not in ("squat", "pushup", "situp"):
        return total

    indices, angulos = _calcular_angulos_primarios(keypoints_por_frame, exercise, side)

    if len(angulos) < _MIN_FRAMES:
        return total

    suavizados = _suavizar(angulos, JANELA_SUAVIZACAO)
    frame_fim = _encontrar_fim(suavizados, indices)

    if frame_fim is None:
        return total

    return min(total, frame_fim)
