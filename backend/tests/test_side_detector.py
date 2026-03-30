"""Testes unitários para detecção do lado de gravação."""

import pytest

from pipeline.side_detector import detectar_lado, RATIO_LIMIAR, _MIN_FRAMES_DETECCAO


# ---------------------------------------------------------------------------
# Helper — gera keypoints sintéticos com visibilidades controladas
# ---------------------------------------------------------------------------

def _gerar_keypoints(vis_esq: float, vis_dir: float) -> list[dict]:
    """
    Gera 33 keypoints onde os keypoints do lado esquerdo têm visibilidade
    `vis_esq` e os do lado direito têm `vis_dir`.
    """
    base = [{"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.5}] * 33
    keypoints = [dict(p) for p in base]

    # Índices dos pares usados pelo side_detector
    pares = [(11, 12), (13, 14), (23, 24), (25, 26), (27, 28)]
    for idx_esq, idx_dir in pares:
        keypoints[idx_esq] = {"x": 0.5, "y": 0.5, "z": 0.0, "visibility": vis_esq}
        keypoints[idx_dir] = {"x": 0.5, "y": 0.5, "z": 0.0, "visibility": vis_dir}

    return keypoints


def _gerar_frames(vis_esq: float, vis_dir: float, n: int = 10) -> list[list[dict]]:
    """Gera n frames com as visibilidades especificadas."""
    return [_gerar_keypoints(vis_esq, vis_dir) for _ in range(n)]


# ---------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------

class TestDetectarLado:
    """Testes para detectar_lado."""

    def test_detecta_lado_esquerdo(self):
        """Visibilidade esquerda alta, direita baixa → 'left'."""
        frames = _gerar_frames(vis_esq=0.95, vis_dir=0.3)
        assert detectar_lado(frames) == "left"

    def test_detecta_lado_direito(self):
        """Visibilidade direita alta, esquerda baixa → 'right'."""
        frames = _gerar_frames(vis_esq=0.3, vis_dir=0.95)
        assert detectar_lado(frames) == "right"

    def test_rejeita_gravacao_frontal(self):
        """Visibilidade semelhante em ambos os lados → ValueError."""
        frames = _gerar_frames(vis_esq=0.9, vis_dir=0.9)
        with pytest.raises(ValueError, match="frontal"):
            detectar_lado(frames)

    def test_erro_poucos_frames(self):
        """Menos de _MIN_FRAMES_DETECCAO frames válidos → ValueError."""
        frames = _gerar_frames(vis_esq=0.95, vis_dir=0.3, n=2)
        with pytest.raises(ValueError, match="poucos frames"):
            detectar_lado(frames)

    def test_frames_none_ignorados(self):
        """Frames None não contam, mas se houver suficientes válidos funciona."""
        frames = [None] * 10 + _gerar_frames(vis_esq=0.95, vis_dir=0.3, n=8)
        assert detectar_lado(frames) == "left"

    def test_todos_none_erro(self):
        """Todos os frames None → erro de poucos frames."""
        frames = [None] * 20
        with pytest.raises(ValueError, match="poucos frames"):
            detectar_lado(frames)

    def test_mediana_robusta_contra_outliers(self):
        """Maioria dos frames indica esquerdo, alguns outliers não mudam resultado."""
        frames_esq = _gerar_frames(vis_esq=0.95, vis_dir=0.3, n=15)
        frames_outlier = _gerar_frames(vis_esq=0.3, vis_dir=0.95, n=3)
        frames = frames_esq + frames_outlier
        assert detectar_lado(frames) == "left"

    def test_visibilidade_zero_direita(self):
        """Lado direito com visibilidade ~0 → detecta esquerdo."""
        frames = _gerar_frames(vis_esq=0.9, vis_dir=0.005, n=10)
        # media_dir < 0.01, esses frames são pulados
        # Precisamos de pelo menos _MIN_FRAMES_DETECCAO frames com dir > 0.01
        # Neste caso todos são pulados, então deve dar erro de poucos frames
        with pytest.raises(ValueError, match="poucos frames"):
            detectar_lado(frames)

    def test_visibilidade_zero_direita_com_frames_validos(self):
        """Alguns frames com dir ~0 (pulados) + suficientes frames válidos."""
        frames_zero = _gerar_frames(vis_esq=0.9, vis_dir=0.005, n=3)
        frames_validos = _gerar_frames(vis_esq=0.95, vis_dir=0.3, n=8)
        frames = frames_zero + frames_validos
        assert detectar_lado(frames) == "left"

    def test_limiar_exato_frontal(self):
        """Razão exatamente no limiar → considerado frontal."""
        # ratio = vis_esq / vis_dir = RATIO_LIMIAR exatamente
        # Isso NÃO é > RATIO_LIMIAR, então cai no frontal
        vis_dir = 0.5
        vis_esq = vis_dir * RATIO_LIMIAR  # ratio exato
        frames = _gerar_frames(vis_esq=vis_esq, vis_dir=vis_dir, n=10)
        with pytest.raises(ValueError, match="frontal"):
            detectar_lado(frames)
