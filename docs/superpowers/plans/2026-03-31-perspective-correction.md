# Perspective Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a perspective correction stage to the pipeline that estimates body rotation (θ) from MediaPipe's Z coordinates and X-separation, then corrects keypoint X coordinates before angle calculation.

**Architecture:** New `perspective_corrector.py` module sits between side detection and movement detection in `video_processor.py`. It estimates per-frame rotation via a hybrid Z + X-separation approach, smooths with EMA, clamps to 35°, and divides X coordinates by cos(θ) anchored to the near-side hip. Downstream modules receive corrected keypoints transparently.

**Tech Stack:** Python, NumPy, math (stdlib). Tests with pytest.

**Spec:** `docs/superpowers/specs/2026-03-31-perspective-correction-design.md`

---

### Task 1: Internal helpers — θ estimation functions

**Files:**
- Create: `backend/pipeline/perspective_corrector.py`
- Create: `backend/tests/test_perspective_corrector.py`

#### Step 1.1

- [ ] **Write failing tests for `_estimar_theta_z`**

This internal function computes θ from Z-coordinate difference between near and far hip.

In `backend/tests/test_perspective_corrector.py`:

```python
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
```

#### Step 1.2

- [ ] **Write failing tests for `_estimar_theta_x`**

Append to the test file:

```python
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
```

#### Step 1.3

- [ ] **Write failing tests for `_calcular_confianca_z`**

Append to the test file:

```python
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
```

#### Step 1.4

- [ ] **Run tests to verify they fail**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/test_perspective_corrector.py -v`

Expected: FAIL — `ImportError: cannot import name '_estimar_theta_z' from 'pipeline.perspective_corrector'`

#### Step 1.5

- [ ] **Implement the three internal helper functions**

Create `backend/pipeline/perspective_corrector.py`:

```python
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
```

#### Step 1.6

- [ ] **Run tests to verify they pass**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/test_perspective_corrector.py -v`

Expected: All 10 tests PASS.

#### Step 1.7

- [ ] **Commit**

```bash
cd /home/veplex13/pose-analyzer/backend
git add pipeline/perspective_corrector.py tests/test_perspective_corrector.py
git commit -m "feat: add θ estimation helpers for perspective correction"
```

---

### Task 2: Per-frame θ estimation and EMA smoothing

**Files:**
- Modify: `backend/pipeline/perspective_corrector.py`
- Modify: `backend/tests/test_perspective_corrector.py`

#### Step 2.1

- [ ] **Write failing tests for `_estimar_theta_frame` and EMA smoothing**

Append to `backend/tests/test_perspective_corrector.py`:

```python
from pipeline.perspective_corrector import _estimar_theta_frame, ALPHA_EMA, FATOR_RUIDO_Z


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
        keypoints[11] = _kp(x=0.5, y=0.3, z=0.5)    # ombro esq — z muito alto
        keypoints[13] = _kp(x=0.5, y=0.45, z=-0.3)   # cotovelo esq — z muito baixo
        keypoints[23] = _kp(x=0.5, y=0.6, z=0.2)     # quadril esq
        keypoints[25] = _kp(x=0.5, y=0.75, z=-0.4)   # joelho esq
        keypoints[27] = _kp(x=0.5, y=0.9, z=0.1)     # tornozelo esq
        # Ombros com separação X para dar sinal a θ_x
        keypoints[11] = _kp(x=0.55, y=0.3, z=0.5)
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
```

Also add the import at the top of the file:

```python
from pipeline.perspective_corrector import (
    _estimar_theta_z,
    _estimar_theta_x,
    _calcular_confianca_z,
    _estimar_theta_frame,
    _aplicar_ema,
    RATIO_LARGURA_OMBRO,
    RATIO_LARGURA_QUADRIL,
    THETA_MAXIMO,
    ALPHA_EMA,
    FATOR_RUIDO_Z,
)
```

#### Step 2.2

- [ ] **Run tests to verify they fail**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/test_perspective_corrector.py::TestEstimarThetaFrame -v`

Expected: FAIL — `ImportError: cannot import name '_estimar_theta_frame'`

#### Step 2.3

- [ ] **Implement `_estimar_theta_frame` and `_aplicar_ema`**

Append to `backend/pipeline/perspective_corrector.py`:

```python
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
```

#### Step 2.4

- [ ] **Run tests to verify they pass**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/test_perspective_corrector.py -v`

Expected: All tests PASS (previous 10 + new 8 = 18 total).

#### Step 2.5

- [ ] **Commit**

```bash
cd /home/veplex13/pose-analyzer/backend
git add pipeline/perspective_corrector.py tests/test_perspective_corrector.py
git commit -m "feat: add per-frame θ estimation and EMA smoothing"
```

---

### Task 3: X correction and public function `corrigir_perspectiva`

**Files:**
- Modify: `backend/pipeline/perspective_corrector.py`
- Modify: `backend/tests/test_perspective_corrector.py`

#### Step 3.1

- [ ] **Write failing tests for X correction and the public function**

Append to `backend/tests/test_perspective_corrector.py`:

```python
from pipeline.perspective_corrector import corrigir_perspectiva


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
```

#### Step 3.2

- [ ] **Run tests to verify they fail**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/test_perspective_corrector.py::TestCorrecaoX -v`

Expected: FAIL — `ImportError: cannot import name 'corrigir_perspectiva'`

#### Step 3.3

- [ ] **Implement `corrigir_perspectiva`**

Append to `backend/pipeline/perspective_corrector.py`:

```python
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

        x_center = keypoints[hip_near_idx]["x"]

        frame_corrigido = []
        for kp in keypoints:
            novo_kp = dict(kp)
            novo_kp["x"] = x_center + (kp["x"] - x_center) / cos_theta
            frame_corrigido.append(novo_kp)

        resultado.append(frame_corrigido)

    return resultado
```

#### Step 3.4

- [ ] **Run all tests to verify they pass**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/test_perspective_corrector.py -v`

Expected: All tests PASS (18 previous + 9 new = 27 total).

#### Step 3.5

- [ ] **Commit**

```bash
cd /home/veplex13/pose-analyzer/backend
git add pipeline/perspective_corrector.py tests/test_perspective_corrector.py
git commit -m "feat: implement X correction and public corrigir_perspectiva function"
```

---

### Task 4: Pipeline integration in `video_processor.py`

**Files:**
- Modify: `backend/pipeline/video_processor.py:1-8` (imports), `backend/pipeline/video_processor.py:54-60` (insert correction)

#### Step 4.1

- [ ] **Write failing integration test**

Append to `backend/tests/test_perspective_corrector.py`:

```python
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
```

#### Step 4.2

- [ ] **Run test to verify it passes** (this test only exercises `corrigir_perspectiva` + `calcular_angulo`, no `video_processor` changes yet)

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/test_perspective_corrector.py::TestIntegracaoPipeline -v`

Expected: PASS

#### Step 4.3

- [ ] **Integrate `corrigir_perspectiva` into `video_processor.py`**

Add import at top of `backend/pipeline/video_processor.py` (after line 5):

```python
from pipeline.perspective_corrector import corrigir_perspectiva
```

Insert correction step between side detection (line 54) and movement detection (line 57). After `side = detectar_lado(keypoints_por_frame)`, add:

```python
    # Corrigir perspectiva — ajusta X para compensar rotação parcial
    keypoints_por_frame = corrigir_perspectiva(keypoints_por_frame, side)
```

The `keypoints_completos` line (current line 59) already preserves the original list via `list(keypoints_por_frame)` — but since `corrigir_perspectiva` returns a **new** list, `keypoints_completos` will now hold the corrected keypoints. We need to save the originals **before** correction for annotation. Change the relevant section to:

```python
    # Detectar lado da gravação (levanta ValueError se frontal)
    side = detectar_lado(keypoints_por_frame)

    # Preservar keypoints originais para anotação do vídeo (sem correção)
    keypoints_completos = list(keypoints_por_frame)

    # Corrigir perspectiva — ajusta X para compensar rotação parcial
    keypoints_por_frame = corrigir_perspectiva(keypoints_por_frame, side)

    # Detectar início e fim do movimento e descartar frames ociosos
    frame_inicio = detectar_inicio_movimento(keypoints_por_frame, exercise, side)
    frame_fim = detectar_fim_movimento(keypoints_por_frame, exercise, side)
    keypoints_por_frame = keypoints_por_frame[frame_inicio:frame_fim]
```

#### Step 4.4

- [ ] **Run all project tests to verify nothing is broken**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/ -v`

Expected: All existing tests + new perspective corrector tests PASS.

#### Step 4.5

- [ ] **Commit**

```bash
cd /home/veplex13/pose-analyzer/backend
git add pipeline/video_processor.py pipeline/perspective_corrector.py tests/test_perspective_corrector.py
git commit -m "feat: integrate perspective correction into video pipeline"
```

---

### Task 5: Add `perspective_correction` to API result

**Files:**
- Modify: `backend/pipeline/perspective_corrector.py`
- Modify: `backend/pipeline/video_processor.py:81-89`
- Modify: `backend/models/schemas.py`

#### Step 5.1

- [ ] **Add `calcular_theta_medio` helper and test**

Append test to `backend/tests/test_perspective_corrector.py`:

```python
from pipeline.perspective_corrector import calcular_theta_medio


class TestCalcularThetaMedio:
    def test_returns_mean_degrees(self):
        """Retorna a média de θ em graus."""
        keypoints = _gerar_keypoints_base()
        keypoints[24] = _kp(x=0.5, y=0.6, z=-0.05)
        frames = [keypoints] * 10
        resultado = calcular_theta_medio(frames, "left")
        assert resultado > 0.0
        assert resultado < 35.0

    def test_zero_rotation(self):
        """Sem rotação → θ médio ≈ 0."""
        keypoints = _gerar_keypoints_base()
        frames = [keypoints] * 10
        resultado = calcular_theta_medio(frames, "left")
        assert resultado == pytest.approx(0.0, abs=0.5)

    def test_all_none_frames(self):
        """Todos frames None → retorna 0."""
        frames = [None] * 10
        resultado = calcular_theta_medio(frames, "left")
        assert resultado == pytest.approx(0.0)
```

#### Step 5.2

- [ ] **Run test to verify it fails**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/test_perspective_corrector.py::TestCalcularThetaMedio -v`

Expected: FAIL — `ImportError: cannot import name 'calcular_theta_medio'`

#### Step 5.3

- [ ] **Implement `calcular_theta_medio`**

Append to `backend/pipeline/perspective_corrector.py`:

```python
def calcular_theta_medio(
    keypoints_por_frame: list[list[dict] | None],
    side: str,
) -> float:
    """
    Calcula o θ médio (em graus) para os frames válidos.
    Usado para reportar no resultado da API.
    """
    thetas_raw = []
    for keypoints in keypoints_por_frame:
        if keypoints is None:
            continue
        thetas_raw.append(_estimar_theta_frame(keypoints, side))

    if not thetas_raw:
        return 0.0

    thetas_smoothed = _aplicar_ema(thetas_raw)
    thetas_clamped = [max(0.0, min(t, THETA_MAXIMO)) for t in thetas_smoothed]
    media = sum(thetas_clamped) / len(thetas_clamped)
    return round(math.degrees(media), 2)
```

#### Step 5.4

- [ ] **Run test to verify it passes**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/test_perspective_corrector.py::TestCalcularThetaMedio -v`

Expected: PASS

#### Step 5.5

- [ ] **Add `perspective_correction` to `video_processor.py` result dict**

Add import in `backend/pipeline/video_processor.py` (update existing import line):

```python
from pipeline.perspective_corrector import corrigir_perspectiva, calcular_theta_medio
```

In the return dict (around line 81), add the new field. Change:

```python
    return {
        "exercise": exercise,
        "confidence": round(confidence, 4),
        "frames_analyzed": frames_analisados,
        "trimmed_start": frame_inicio,
        "trimmed_end": frame_fim,
        "detected_side": side,
        **resultado,  # result, joint_angles, joint_results, errors
    }
```

To:

```python
    theta_medio = calcular_theta_medio(keypoints_por_frame, side)

    return {
        "exercise": exercise,
        "confidence": round(confidence, 4),
        "frames_analyzed": frames_analisados,
        "trimmed_start": frame_inicio,
        "trimmed_end": frame_fim,
        "detected_side": side,
        "perspective_correction": {
            "mean_theta_degrees": theta_medio,
            "applied": True,
        },
        **resultado,  # result, joint_angles, joint_results, errors
    }
```

#### Step 5.6

- [ ] **Update Pydantic schema in `models/schemas.py`**

Add a new model and update `AnalysisResult`:

```python
class PerspectiveCorrection(BaseModel):
    mean_theta_degrees: float
    applied: bool


class AnalysisResult(BaseModel):
    exercise: Literal["squat", "situp", "pushup"]
    result: Literal["correct", "incorrect"]
    confidence: float
    frames_analyzed: int
    joint_angles: dict[str, list[float]]
    joint_results: dict[str, Literal["correct", "incorrect"]]
    errors: list[str]
    video_url: Optional[str] = None
    detected_side: Optional[Literal["left", "right"]] = None
    perspective_correction: Optional[PerspectiveCorrection] = None
```

#### Step 5.7

- [ ] **Run all tests**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/ -v`

Expected: All tests PASS.

#### Step 5.8

- [ ] **Commit**

```bash
cd /home/veplex13/pose-analyzer/backend
git add pipeline/perspective_corrector.py pipeline/video_processor.py models/schemas.py tests/test_perspective_corrector.py
git commit -m "feat: add perspective_correction field to API result"
```

---

### Task 6: Final validation — run full test suite

**Files:** None (validation only)

#### Step 6.1

- [ ] **Run the full test suite**

Run: `cd /home/veplex13/pose-analyzer/backend && python -m pytest tests/ -v --tb=short`

Expected: All tests PASS. No regressions.

#### Step 6.2

- [ ] **Verify module imports are clean**

Run: `cd /home/veplex13/pose-analyzer/backend && python -c "from pipeline.perspective_corrector import corrigir_perspectiva, calcular_theta_medio; print('OK')"`

Expected: `OK`

#### Step 6.3

- [ ] **Final commit (if any formatting changes needed)**

Only if needed:

```bash
cd /home/veplex13/pose-analyzer/backend
git add -A
git commit -m "style: format perspective corrector code"
```
