"""Testes unitários para correção de perspectiva."""

import math

import pytest

from pipeline.perspective_corrector import (
    _estimar_theta_z,
    _estimar_theta_x,
    _calcular_confianca_z,
    _estimar_theta_frame,
    _aplicar_ema,
    corrigir_perspectiva,
    RATIO_LARGURA_OMBRO,
    RATIO_LARGURA_QUADRIL,
    THETA_MAXIMO,
    ALPHA_EMA,
    FATOR_RUIDO_Z,
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


# ---------------------------------------------------------------------------
# Testes — estimação de θ por frame
# ---------------------------------------------------------------------------

class TestEstimarThetaFrame:
    def test_perfect_side_view(self):
        """Keypoints alinhados (ΔZ=0, ΔX=0) → θ ≈ 0."""
        keypoints = _gerar_keypoints_base()
        theta = _estimar_theta_frame(keypoints, "left")
        assert theta == pytest.approx(0.0, abs=0.01)

    def test_known_z_rotation(self):
        """Offset Z controlado com X alinhado → θ dominado por θ_z."""
        keypoints = _gerar_keypoints_base()
        # Adicionar offset Z no far hip (dir) para simular rotação
        keypoints[24] = _kp(x=0.5, y=0.6, z=-0.05)
        theta = _estimar_theta_frame(keypoints, "left")
        # θ deve ser positivo (rotação detectada)
        assert theta > 0.05

    def test_noisy_z_shifts_to_theta_x(self):
        """Z ruidoso nos keypoints do near side → confiança cai, θ_x domina."""
        keypoints = _gerar_keypoints_base()
        # Ruído alto em Z nos keypoints do lado near
        keypoints[11] = _kp(x=0.55, y=0.3, z=0.5)    # ombro esq — z muito alto, X shifted
        keypoints[13] = _kp(x=0.5, y=0.45, z=-0.3)   # cotovelo esq — z muito baixo
        keypoints[23] = _kp(x=0.5, y=0.6, z=0.2)     # quadril esq
        keypoints[25] = _kp(x=0.5, y=0.75, z=-0.4)   # joelho esq
        keypoints[27] = _kp(x=0.5, y=0.9, z=0.1)     # tornozelo esq
        # Ombros com separação X para dar sinal a θ_x
        keypoints[12] = _kp(x=0.45, y=0.3, z=0.0)
        theta = _estimar_theta_frame(keypoints, "left")
        # Deve retornar um valor válido (não NaN, não negativo)
        assert theta >= 0.0
        assert not math.isnan(theta)

    def test_degenerate_torso_returns_zero(self):
        """Torso height ≈ 0 → θ = 0 (frame degenerado)."""
        keypoints = _gerar_keypoints_base()
        # Ombro e quadril na mesma posição Y
        keypoints[11] = _kp(x=0.5, y=0.5, z=0.0)
        keypoints[23] = _kp(x=0.5, y=0.5, z=0.0)
        theta = _estimar_theta_frame(keypoints, "left")
        assert theta == pytest.approx(0.0, abs=1e-6)


# ---------------------------------------------------------------------------
# Testes — suavização EMA
# ---------------------------------------------------------------------------

class TestEMASuavizacao:
    def test_constant_sequence_converges(self):
        """Sequência constante de θ → EMA converge para o valor."""
        thetas_raw = [0.2] * 20
        smoothed = _aplicar_ema(thetas_raw)
        assert smoothed[-1] == pytest.approx(0.2, abs=0.01)

    def test_spike_dampened(self):
        """Spike único → EMA amortece."""
        thetas_raw = [0.1] * 10 + [0.5] + [0.1] * 10
        smoothed = _aplicar_ema(thetas_raw)
        # No ponto do spike (index 10), o smoothed deve ser menor que o raw
        assert smoothed[10] < 0.5
        # Após o spike, deve convergir de volta
        assert smoothed[-1] == pytest.approx(0.1, abs=0.02)

    def test_empty_list(self):
        """Lista vazia → retorna lista vazia."""
        assert _aplicar_ema([]) == []

    def test_single_value(self):
        """Um único valor → retorna esse valor."""
        assert _aplicar_ema([0.3]) == [pytest.approx(0.3)]


# ---------------------------------------------------------------------------
# Testes — corrigir_perspectiva (X correction)
# ---------------------------------------------------------------------------


class TestCorrecaoX:
    def test_zero_theta_no_change(self):
        """θ = 0 → X de saída == X de entrada."""
        keypoints = _gerar_keypoints_base()
        frames = [keypoints] * 10
        resultado = corrigir_perspectiva(frames, "left")
        for frame_orig, frame_corr in zip(frames, resultado):
            for kp_orig, kp_corr in zip(frame_orig, frame_corr):
                assert kp_corr["x"] == pytest.approx(kp_orig["x"], abs=1e-6)
                assert kp_corr["y"] == kp_orig["y"]

    def test_known_rotation_expands_x(self):
        """θ > 0 → pontos longe do quadril expandem em X."""
        keypoints = _gerar_keypoints_base()
        # Forçar rotação via offset Z
        keypoints[24] = _kp(x=0.5, y=0.6, z=-0.1)  # far hip com Z diferente
        # Colocar um keypoint com X diferente do hip anchor para ver a expansão
        keypoints[11] = _kp(x=0.4, y=0.3, z=0.0)   # ombro near com X != hip
        frames = [keypoints] * 15
        resultado = corrigir_perspectiva(frames, "left")
        # O ombro corrigido deve estar mais longe do quadril em X
        hip_x = keypoints[23]["x"]  # 0.5
        ombro_orig_dist = abs(keypoints[11]["x"] - hip_x)       # 0.1
        ombro_corr_dist = abs(resultado[-1][11]["x"] - hip_x)
        assert ombro_corr_dist > ombro_orig_dist

    def test_hip_anchor_unchanged(self):
        """Quadril do near side não se move após correção."""
        keypoints = _gerar_keypoints_base()
        keypoints[24] = _kp(x=0.5, y=0.6, z=-0.1)
        frames = [keypoints] * 10
        resultado = corrigir_perspectiva(frames, "left")
        for frame in resultado:
            assert frame[23]["x"] == pytest.approx(keypoints[23]["x"], abs=1e-6)

    def test_y_unchanged(self):
        """Coordenadas Y não são alteradas."""
        keypoints = _gerar_keypoints_base()
        keypoints[24] = _kp(x=0.5, y=0.6, z=-0.1)
        frames = [keypoints] * 10
        resultado = corrigir_perspectiva(frames, "left")
        for frame_orig, frame_corr in zip(frames, resultado):
            for kp_orig, kp_corr in zip(frame_orig, frame_corr):
                assert kp_corr["y"] == kp_orig["y"]

    def test_none_frames_pass_through(self):
        """Frames None passam sem alteração."""
        keypoints = _gerar_keypoints_base()
        frames = [None, keypoints, None, keypoints, None]
        resultado = corrigir_perspectiva(frames, "left")
        assert resultado[0] is None
        assert resultado[2] is None
        assert resultado[4] is None
        assert resultado[1] is not None
        assert resultado[3] is not None

    def test_does_not_mutate_input(self):
        """A lista original não é alterada."""
        keypoints = _gerar_keypoints_base()
        keypoints[24] = _kp(x=0.5, y=0.6, z=-0.1)
        keypoints[11] = _kp(x=0.4, y=0.3, z=0.0)
        original_x = keypoints[11]["x"]
        frames = [keypoints] * 5
        corrigir_perspectiva(frames, "left")
        assert frames[0][11]["x"] == original_x


class TestClamping:
    def test_theta_clamped_to_max(self):
        """θ > THETA_MAXIMO → corrigido com cos(THETA_MAXIMO), não mais."""
        keypoints = _gerar_keypoints_base()
        # ΔZ enorme para forçar θ > 35°
        keypoints[24] = _kp(x=0.5, y=0.6, z=-1.0)
        keypoints[11] = _kp(x=0.3, y=0.3, z=0.0)
        frames = [keypoints] * 15
        resultado = corrigir_perspectiva(frames, "left")
        # Expansão máxima = 1/cos(35°) ≈ 1.2208
        hip_x = keypoints[23]["x"]
        ombro_orig_dist = abs(keypoints[11]["x"] - hip_x)
        ombro_corr_dist = abs(resultado[-1][11]["x"] - hip_x)
        max_expansion = 1.0 / math.cos(THETA_MAXIMO)
        actual_expansion = ombro_corr_dist / ombro_orig_dist if ombro_orig_dist > 0 else 1.0
        assert actual_expansion == pytest.approx(max_expansion, abs=0.05)

    def test_negative_theta_clamped_to_zero(self):
        """θ negativo impossível na prática (abs usado), mas clamped a 0."""
        keypoints = _gerar_keypoints_base()
        frames = [keypoints] * 10
        resultado = corrigir_perspectiva(frames, "left")
        # Com zero rotation, output == input
        for frame_orig, frame_corr in zip(frames, resultado):
            for kp_orig, kp_corr in zip(frame_orig, frame_corr):
                assert kp_corr["x"] == pytest.approx(kp_orig["x"], abs=1e-6)


class TestRightSide:
    def test_right_side_uses_correct_anchor(self):
        """Side 'right' ancora no quadril direito (idx 24)."""
        keypoints = _gerar_keypoints_base()
        keypoints[23] = _kp(x=0.5, y=0.6, z=-0.1)  # far hip (esq) com Z offset
        keypoints[12] = _kp(x=0.4, y=0.3, z=0.0)   # ombro near (dir)
        frames = [keypoints] * 15
        resultado = corrigir_perspectiva(frames, "right")
        # Quadril direito (near) não se move
        for frame in resultado:
            assert frame[24]["x"] == pytest.approx(keypoints[24]["x"], abs=1e-6)


class TestIntegracaoPipeline:
    def test_correcao_melhora_angulos_com_rotacao(self):
        """
        Keypoints sintéticos com rotação conhecida:
        os ângulos calculados após correção devem estar mais próximos
        dos ângulos reais do que sem correção.
        """
        from pipeline.angle_calculator import calcular_angulo

        keypoints = _gerar_keypoints_base()
        # Simular squat: quadril(23) → joelho(25) → tornozelo(27)
        # Posição "real" lateral: joelho em x=0.5 (alinhado com quadril e tornozelo)
        # mas com rotação, x é comprimido
        theta_real = math.radians(20)
        cos_t = math.cos(theta_real)
        hip_x = 0.5

        # Posicionar keypoints como se o corpo estivesse rotacionado 20°
        keypoints[23] = _kp(x=hip_x, y=0.6, z=0.0)                      # quadril
        keypoints[25] = _kp(x=hip_x + (0.05 * cos_t), y=0.75, z=0.0)    # joelho (comprimido)
        keypoints[27] = _kp(x=hip_x + (-0.02 * cos_t), y=0.9, z=0.0)    # tornozelo (comprimido)
        # Dar sinal de rotação via Z
        keypoints[24] = _kp(x=0.5, y=0.6, z=-0.06)  # far hip

        frames = [keypoints] * 15

        # Ângulo sem correção (comprimido)
        angulo_sem = calcular_angulo(keypoints[23], keypoints[25], keypoints[27])

        # Ângulo com correção
        corrigidos = corrigir_perspectiva(frames, "left")
        angulo_com = calcular_angulo(corrigidos[-1][23], corrigidos[-1][25], corrigidos[-1][27])

        # Ângulo "verdadeiro" (posições sem compressão)
        kp_real_hip = _kp(x=hip_x, y=0.6)
        kp_real_knee = _kp(x=hip_x + 0.05, y=0.75)
        kp_real_ankle = _kp(x=hip_x - 0.02, y=0.9)
        angulo_real = calcular_angulo(kp_real_hip, kp_real_knee, kp_real_ankle)

        # O ângulo corrigido deve estar mais próximo do real
        erro_sem = abs(angulo_sem - angulo_real)
        erro_com = abs(angulo_com - angulo_real)
        assert erro_com < erro_sem
