"""Testes unitários para detecção de início e fim de movimento."""

import math

import pytest

from pipeline.movement_detector import detectar_fim_movimento, detectar_inicio_movimento
from pipeline.postural_checker import (
    COTOVELO_ESQ,
    JOELHO_ESQ,
    OMBRO_ESQ,
    PULSO_ESQ,
    QUADRIL_ESQ,
    TORNOZELO_ESQ,
)


# ---------------------------------------------------------------------------
# Helper — gera keypoints sintéticos com ângulo desejado na articulação primária
# ---------------------------------------------------------------------------

# Mapeamento exercício → (p1_idx, p2_idx, p3_idx) — mesma ordem de postural_checker
_JOINT_MAP = {
    "squat":  (QUADRIL_ESQ, JOELHO_ESQ, TORNOZELO_ESQ),
    "pushup": (OMBRO_ESQ, COTOVELO_ESQ, PULSO_ESQ),
    "situp":  (OMBRO_ESQ, QUADRIL_ESQ, JOELHO_ESQ),
}


def _gerar_keypoints(angulo_graus: float, exercise: str) -> list[dict]:
    """
    Gera uma lista de 33 keypoints (formato MediaPipe) onde a articulação
    primária do exercício tem exatamente o ângulo desejado.

    Posiciona p2 (vértice) na origem, p1 apontando para cima (y negativo),
    e p3 rotacionado pelo ângulo desejado.
    """
    p1_idx, p2_idx, p3_idx = _JOINT_MAP[exercise]
    rad = math.radians(angulo_graus)

    # p2 no centro, p1 para cima, p3 rotacionado
    base = [{"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.95}] * 33
    # Cópia real para não mutar
    keypoints = [dict(p) for p in base]

    keypoints[p2_idx] = {"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.95}
    keypoints[p1_idx] = {"x": 0.5, "y": 0.4, "z": 0.0, "visibility": 0.95}  # acima
    keypoints[p3_idx] = {
        "x": 0.5 + 0.1 * math.sin(rad),
        "y": 0.5 - 0.1 * math.cos(rad),
        "z": 0.0,
        "visibility": 0.95,
    }

    return keypoints


def _gerar_sequencia(angulos: list[float], exercise: str) -> list[list[dict]]:
    """Gera uma sequência de frames com os ângulos especificados."""
    return [_gerar_keypoints(a, exercise) for a in angulos]


# ---------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------


class TestDetectarInicioMovimento:
    """Testes para detectar_inicio_movimento."""

    def test_detecta_inicio_apos_frames_parados(self):
        """20 frames parados em ~170° + 15 frames descendo até ~90°."""
        angulos = [170.0] * 20 + [170 - (80 / 14) * i for i in range(15)]
        frames = _gerar_sequencia(angulos, "squat")

        inicio = detectar_inicio_movimento(frames, "squat")

        # A suavização detecta a transição ~4 frames antes do frame 20,
        # e o lookback (3 frames) recua mais. Resultado esperado: ~13.
        assert 10 <= inicio <= 20

    def test_retorna_zero_quando_nao_ha_movimento(self):
        """30 frames com ângulo constante — sem movimento."""
        angulos = [170.0] * 30
        frames = _gerar_sequencia(angulos, "squat")

        inicio = detectar_inicio_movimento(frames, "squat")

        assert inicio == 0

    def test_retorna_zero_para_video_curto(self):
        """Vídeo com poucos frames — não há dados suficientes para análise."""
        angulos = [170.0, 150.0, 130.0]
        frames = _gerar_sequencia(angulos, "squat")

        inicio = detectar_inicio_movimento(frames, "squat")

        assert inicio == 0

    def test_ignora_fidget_pequeno(self):
        """Jitter de ±3° não deve ser detectado como início de movimento."""
        import random

        random.seed(42)
        jitter = [170 + random.uniform(-3, 3) for _ in range(20)]
        descida = [170 - (80 / 14) * i for i in range(15)]
        angulos = jitter + descida
        frames = _gerar_sequencia(angulos, "squat")

        inicio = detectar_inicio_movimento(frames, "squat")

        # Deve ignorar o jitter e detectar apenas a descida real (~frame 20).
        # Com suavização + lookback, resultado esperado: >= 10
        assert inicio >= 10

    def test_movimento_comeca_imediatamente(self):
        """Ângulo decresce desde o frame 0 — deve retornar 0."""
        angulos = [170 - (80 / 29) * i for i in range(30)]
        frames = _gerar_sequencia(angulos, "squat")

        inicio = detectar_inicio_movimento(frames, "squat")

        assert inicio == 0

    @pytest.mark.parametrize("exercise", ["squat", "pushup", "situp"])
    def test_funciona_para_todos_exercicios(self, exercise):
        """Detecção funciona para squat, pushup e situp."""
        angulos = [170.0] * 20 + [170 - (80 / 14) * i for i in range(15)]
        frames = _gerar_sequencia(angulos, exercise)

        inicio = detectar_inicio_movimento(frames, exercise)

        assert 10 <= inicio <= 20

    def test_frames_none_nao_quebram_deteccao(self):
        """Frames sem keypoints (None) no período ocioso não impedem detecção."""
        angulos = [170.0] * 20 + [170 - (80 / 14) * i for i in range(15)]
        frames = _gerar_sequencia(angulos, "squat")
        # Inserir Nones nos primeiros frames
        frames[2] = None
        frames[5] = None
        frames[8] = None

        inicio = detectar_inicio_movimento(frames, "squat")

        assert 10 <= inicio <= 20


class TestDetectarFimMovimento:
    """Testes para detectar_fim_movimento."""

    def test_detecta_fim_antes_de_frames_parados(self):
        """15 frames de exercício + subida de volta a ~170° + 20 frames parados."""
        descida = [170 - (80 / 14) * i for i in range(15)]
        subida = [90 + (80 / 14) * i for i in range(15)]
        angulos = descida + subida + [170.0] * 20
        frames = _gerar_sequencia(angulos, "squat")

        fim = detectar_fim_movimento(frames, "squat")

        # Deve cortar os ~20 frames parados no final.
        # O total é 50 frames, o fim real é por volta do frame 30.
        assert 30 <= fim <= 40

    def test_retorna_total_quando_nao_ha_idle_no_fim(self):
        """Vídeo termina no meio do exercício — sem idle no final."""
        angulos = [170 - (80 / 29) * i for i in range(30)]
        frames = _gerar_sequencia(angulos, "squat")

        fim = detectar_fim_movimento(frames, "squat")

        assert fim == len(frames)

    def test_retorna_total_quando_nao_ha_movimento(self):
        """30 frames constantes — sem trimming (tudo idle, nada a cortar)."""
        angulos = [170.0] * 30
        frames = _gerar_sequencia(angulos, "squat")

        fim = detectar_fim_movimento(frames, "squat")

        assert fim == len(frames)

    def test_retorna_total_para_video_curto(self):
        """Vídeo com poucos frames — não há dados suficientes."""
        angulos = [170.0, 150.0, 130.0]
        frames = _gerar_sequencia(angulos, "squat")

        fim = detectar_fim_movimento(frames, "squat")

        assert fim == len(frames)

    def test_ignora_fidget_no_final(self):
        """Jitter de ±3° no final não deve ser detectado como movimento."""
        import random

        random.seed(42)
        descida = [170 - (80 / 14) * i for i in range(15)]
        subida = [90 + (80 / 14) * i for i in range(15)]
        jitter = [170 + random.uniform(-3, 3) for _ in range(20)]
        angulos = descida + subida + jitter
        frames = _gerar_sequencia(angulos, "squat")

        fim = detectar_fim_movimento(frames, "squat")

        # Deve cortar o jitter no final, fim por volta de frame 30-40
        assert fim <= 40

    @pytest.mark.parametrize("exercise", ["squat", "pushup", "situp"])
    def test_funciona_para_todos_exercicios(self, exercise):
        """Detecção de fim funciona para squat, pushup e situp."""
        descida = [170 - (80 / 14) * i for i in range(15)]
        subida = [90 + (80 / 14) * i for i in range(15)]
        angulos = descida + subida + [170.0] * 20
        frames = _gerar_sequencia(angulos, exercise)

        fim = detectar_fim_movimento(frames, exercise)

        assert 30 <= fim <= 40

    def test_frames_none_no_final_nao_quebram_deteccao(self):
        """Frames None no período ocioso final não impedem detecção."""
        descida = [170 - (80 / 14) * i for i in range(15)]
        subida = [90 + (80 / 14) * i for i in range(15)]
        angulos = descida + subida + [170.0] * 20
        frames = _gerar_sequencia(angulos, "squat")
        # Inserir Nones nos últimos frames
        frames[-3] = None
        frames[-7] = None
        frames[-12] = None

        fim = detectar_fim_movimento(frames, "squat")

        assert 30 <= fim <= 40
