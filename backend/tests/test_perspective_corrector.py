"""Testes unitários para correção de perspectiva."""

import math

import pytest

from pipeline.perspective_corrector import (
    _estimar_theta_z,
    _estimar_theta_x,
    _calcular_confianca_z,
    RATIO_LARGURA_OMBRO,
    RATIO_LARGURA_QUADRIL,
    THETA_MAXIMO,
)


# ---------------------------------------------------------------------------
# Helper — gera keypoints sintéticos com coordenadas controladas
# ---------------------------------------------------------------------------

def _kp(x=0.5, y=0.5, z=0.0, visibility=0.9):
    """Cria um keypoint dict."""
    return {"x": x, "y": y, "z": z, "visibility": visibility}


def _gerar_keypoints_base() -> list[dict]:
    """
    Gera 33 keypoints em posição lateral padrão.
    Ombro em y=0.3, quadril em y=0.6 (torso_height=0.3).
    Todos com z=0 e visibility=0.9.
    """
    base = [_kp() for _ in range(33)]
    # Lado esquerdo (near side para side="left")
    base[11] = _kp(x=0.5, y=0.3, z=0.0)   # ombro esq
    base[13] = _kp(x=0.5, y=0.45, z=0.0)  # cotovelo esq
    base[23] = _kp(x=0.5, y=0.6, z=0.0)   # quadril esq
    base[25] = _kp(x=0.5, y=0.75, z=0.0)  # joelho esq
    base[27] = _kp(x=0.5, y=0.9, z=0.0)   # tornozelo esq
    # Lado direito (far side para side="left")
    base[12] = _kp(x=0.5, y=0.3, z=0.0)   # ombro dir
    base[14] = _kp(x=0.5, y=0.45, z=0.0)  # cotovelo dir
    base[24] = _kp(x=0.5, y=0.6, z=0.0)   # quadril dir
    base[26] = _kp(x=0.5, y=0.75, z=0.0)  # joelho dir
    base[28] = _kp(x=0.5, y=0.9, z=0.0)   # tornozelo dir
    return base


# ---------------------------------------------------------------------------
# Testes — estimação de θ_z
# ---------------------------------------------------------------------------

class TestEstimarThetaZ:
    def test_zero_rotation(self):
        """ΔZ = 0 entre quadris → θ_z = 0."""
        hip_near_z = 0.0
        hip_far_z = 0.0
        body_width = 0.3 * RATIO_LARGURA_QUADRIL
        assert _estimar_theta_z(hip_near_z, hip_far_z, body_width) == pytest.approx(0.0, abs=1e-6)

    def test_known_rotation(self):
        """ΔZ controlado → θ_z corresponde ao atan2 esperado."""
        body_width = 0.3 * RATIO_LARGURA_QUADRIL  # 0.135
        delta_z = 0.05
        expected = math.atan2(delta_z, body_width)
        result = _estimar_theta_z(0.0, -0.05, body_width)
        assert result == pytest.approx(expected, abs=1e-6)

    def test_body_width_zero_returns_zero(self):
        """Body width ≈ 0 (degenerado) → retorna 0."""
        assert _estimar_theta_z(0.0, -0.05, 0.0) == pytest.approx(0.0, abs=1e-6)


# ---------------------------------------------------------------------------
# Testes — estimação de θ_x
# ---------------------------------------------------------------------------

class TestEstimarThetaX:
    def test_zero_separation(self):
        """Ombros na mesma posição X → θ_x = 0."""
        assert _estimar_theta_x(0.0, 0.3 * RATIO_LARGURA_OMBRO) == pytest.approx(0.0, abs=1e-6)

    def test_known_separation(self):
        """Separação X controlada → θ_x = asin(sep / ref_width)."""
        ref_width = 0.3 * RATIO_LARGURA_OMBRO  # 0.165
        sep = 0.08
        expected = math.asin(sep / ref_width)
        result = _estimar_theta_x(sep, ref_width)
        assert result == pytest.approx(expected, abs=1e-6)

    def test_clamps_to_valid_asin_range(self):
        """Separação > ref_width → clampado, não estoura asin."""
        ref_width = 0.1
        sep = 0.2  # > ref_width
        result = _estimar_theta_x(sep, ref_width)
        assert result == pytest.approx(math.pi / 2, abs=1e-6)

    def test_ref_width_zero_returns_zero(self):
        """ref_width ≈ 0 (degenerado) → retorna 0."""
        assert _estimar_theta_x(0.05, 0.0) == pytest.approx(0.0, abs=1e-6)


# ---------------------------------------------------------------------------
# Testes — cálculo de confiança Z
# ---------------------------------------------------------------------------

class TestCalcularConfiancaZ:
    def test_zero_noise_full_confidence(self):
        """Ruído zero → confiança = 1.0."""
        assert _calcular_confianca_z(0.0) == pytest.approx(1.0, abs=1e-6)

    def test_high_noise_low_confidence(self):
        """Ruído alto → confiança próxima de 0."""
        result = _calcular_confianca_z(1.0)
        assert result < 0.15

    def test_moderate_noise(self):
        """Ruído moderado → confiança entre 0 e 1."""
        result = _calcular_confianca_z(0.1)
        assert 0.0 < result < 1.0
