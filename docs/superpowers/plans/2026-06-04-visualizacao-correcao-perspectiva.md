# Visualização da correção de perspectiva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um script standalone que gera um PNG lado a lado (esqueleto original | corrigido) ilustrando o efeito do `perspective_corrector.py`, escolhendo automaticamente o frame de maior θ.

**Architecture:** Uma função pura nova em `perspective_corrector.py` expõe o θ por frame (já suavizado/clampado, em graus) compondo helpers privados existentes sem alterá-los. Um script em `backend/scripts/` roda o pipeline (MediaPipe → detectar lado → corrigir perspectiva), usa o argmax do θ para escolher o frame, e desenha os dois esqueletos sobre o mesmo frame com OpenCV.

**Tech Stack:** Python, OpenCV (`cv2`), NumPy, MediaPipe, pytest. Sem dependências novas.

---

## File Structure

- **Modify:** `backend/pipeline/perspective_corrector.py` — adiciona `estimar_thetas_por_frame` (não altera `corrigir_perspectiva`/`calcular_theta_medio`).
- **Test:** `backend/tests/test_perspective_corrector.py` — nova classe de testes para a função.
- **Create:** `backend/scripts/visualizar_correcao_perspectiva.py` — script standalone (CLI + desenho + composição).

Todos os comandos abaixo assumem `cwd = backend/` (onde os módulos `pipeline.*` resolvem).

---

## Task 1: Função `estimar_thetas_por_frame`

**Files:**
- Modify: `backend/pipeline/perspective_corrector.py`
- Test: `backend/tests/test_perspective_corrector.py`

- [ ] **Step 1: Adicionar a função ao import do teste**

Em `backend/tests/test_perspective_corrector.py`, no bloco de import existente
(linhas 7-20), adicione `estimar_thetas_por_frame` à lista importada:

```python
from pipeline.perspective_corrector import (
    _estimar_theta_z,
    _estimar_theta_x,
    _calcular_confianca_z,
    _estimar_theta_frame,
    _aplicar_ema,
    corrigir_perspectiva,
    calcular_theta_medio,
    estimar_thetas_por_frame,
    RATIO_LARGURA_OMBRO,
    RATIO_LARGURA_QUADRIL,
    THETA_MAXIMO,
    ALPHA_EMA,
    FATOR_RUIDO_Z,
)
```

- [ ] **Step 2: Escrever os testes que falham**

Adicione ao **final** de `backend/tests/test_perspective_corrector.py` esta nova
classe (usa os helpers `_kp` e `_gerar_keypoints_base` já definidos no arquivo):

```python
# ---------------------------------------------------------------------------
# Testes — estimar_thetas_por_frame
# ---------------------------------------------------------------------------


class TestEstimarThetasPorFrame:
    def test_length_matches_input(self):
        """Resultado tem o mesmo comprimento da entrada."""
        frames = [_gerar_keypoints_base()] * 8
        result = estimar_thetas_por_frame(frames, "left")
        assert len(result) == 8

    def test_none_frames_passthrough(self):
        """Frames None viram None no resultado, preservando os índices."""
        kp = _gerar_keypoints_base()
        frames = [None, kp, None, kp]
        result = estimar_thetas_por_frame(frames, "left")
        assert result[0] is None
        assert result[2] is None
        assert result[1] is not None
        assert result[3] is not None

    def test_zero_rotation_near_zero(self):
        """Sem rotação → todos os θ ≈ 0."""
        frames = [_gerar_keypoints_base()] * 10
        result = estimar_thetas_por_frame(frames, "left")
        assert all(t == pytest.approx(0.0, abs=0.5) for t in result)

    def test_rotation_positive_and_in_degrees(self):
        """Com rotação moderada → θ positivo e em graus (abaixo do clamp)."""
        kp = _gerar_keypoints_base()
        kp[24] = _kp(x=0.5, y=0.6, z=-0.05)  # far hip com Z offset
        frames = [kp] * 10
        result = estimar_thetas_por_frame(frames, "left")
        assert result[-1] > 0.0
        assert result[-1] < 35.0

    def test_clamped_to_max_degrees(self):
        """ΔZ enorme → θ clampado a THETA_MAXIMO (35°)."""
        kp = _gerar_keypoints_base()
        kp[24] = _kp(x=0.5, y=0.6, z=-1.0)
        frames = [kp] * 15
        result = estimar_thetas_por_frame(frames, "left")
        assert max(result) == pytest.approx(35.0, abs=0.5)

    def test_all_none_returns_all_none(self):
        """Todos frames None → lista de None do mesmo tamanho."""
        frames = [None] * 5
        result = estimar_thetas_por_frame(frames, "left")
        assert result == [None] * 5
```

- [ ] **Step 3: Rodar os testes e verificar que falham**

Run: `cd backend && python -m pytest tests/test_perspective_corrector.py::TestEstimarThetasPorFrame -v`
Expected: FAIL — `ImportError: cannot import name 'estimar_thetas_por_frame'`

- [ ] **Step 4: Implementar a função**

Em `backend/pipeline/perspective_corrector.py`, adicione a função **logo após**
`calcular_theta_medio` (após a linha 167, antes de `corrigir_perspectiva`).
Ela compõe os helpers existentes (`_estimar_theta_frame`, `_aplicar_ema`,
`THETA_MAXIMO`) — espelhando o pipeline raw→EMA→clamp de `corrigir_perspectiva`,
mas retornando o θ em graus por frame com passthrough de `None`:

```python
def estimar_thetas_por_frame(
    keypoints_por_frame: list[list[dict] | None],
    side: str,
) -> list[float | None]:
    """
    Retorna o θ (em graus) por frame, já suavizado por EMA e clampado a
    THETA_MAXIMO — o mesmo θ que corrigir_perspectiva aplica em cada frame.

    Frames None retornam None (passthrough), preservando o alinhamento de
    índices com a lista de entrada. Útil para selecionar o frame de maior
    rotação ao visualizar a correção.
    """
    thetas_raw = []
    valid_indices = []
    for i, keypoints in enumerate(keypoints_por_frame):
        if keypoints is None:
            continue
        thetas_raw.append(_estimar_theta_frame(keypoints, side))
        valid_indices.append(i)

    if not thetas_raw:
        return [None] * len(keypoints_por_frame)

    thetas_smoothed = _aplicar_ema(thetas_raw)
    thetas_clamped = [max(0.0, min(t, THETA_MAXIMO)) for t in thetas_smoothed]

    theta_map = dict(zip(valid_indices, thetas_clamped))
    return [
        math.degrees(theta_map[i]) if i in theta_map else None
        for i in range(len(keypoints_por_frame))
    ]
```

- [ ] **Step 5: Rodar os testes e verificar que passam**

Run: `cd backend && python -m pytest tests/test_perspective_corrector.py::TestEstimarThetasPorFrame -v`
Expected: PASS — 6 passed

- [ ] **Step 6: Rodar a suíte completa do módulo (regressão)**

Run: `cd backend && python -m pytest tests/test_perspective_corrector.py -v`
Expected: PASS — todos os testes existentes continuam passando

- [ ] **Step 7: Commit**

```bash
cd /home/bernardo/pose-analyzer
git add backend/pipeline/perspective_corrector.py backend/tests/test_perspective_corrector.py
git commit -m "feat(perspective): add estimar_thetas_por_frame para θ por frame em graus"
```

---

## Task 2: Script de visualização

**Files:**
- Create: `backend/scripts/visualizar_correcao_perspectiva.py`

- [ ] **Step 1: Criar o script completo**

Crie `backend/scripts/visualizar_correcao_perspectiva.py` com este conteúdo
exato:

```python
"""
Script standalone — gera uma imagem (PNG) lado a lado ilustrando o efeito da
correção de perspectiva: esqueleto MediaPipe original | esqueleto corrigido,
plotados sobre o mesmo frame de um vídeo.

O frame é escolhido automaticamente como o de maior θ (rotação mais visível),
com override opcional via --frame. O quadril do lado visível (âncora da
correção, que não se move) é destacado.

Uso:
    python scripts/visualizar_correcao_perspectiva.py video.mp4 -o saida.png [--frame 42]
"""

import argparse
import os
import sys

import cv2
import mediapipe as mp
import numpy as np

# Permite rodar o script de qualquer diretório resolvendo os módulos pipeline.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.mediapipe_runner import inicializar_pose, extrair_keypoints
from pipeline.side_detector import detectar_lado
from pipeline.perspective_corrector import (
    corrigir_perspectiva,
    estimar_thetas_por_frame,
)
from pipeline.postural_checker import QUADRIL_ESQ, QUADRIL_DIR

# Conexões do esqueleto MediaPipe Pose
_POSE_CONNECTIONS = mp.solutions.pose.POSE_CONNECTIONS
# Landmarks de face (nariz, olhos, orelhas, boca) — não exibidos
_FACE_LANDMARKS = frozenset(range(11))

# Cores em BGR (OpenCV)
COR_ESQUELETO = (200, 200, 200)  # cinza claro
COR_PIVO      = (0, 215, 255)    # dourado — destaca o quadril-âncora
COR_TITULO    = (255, 255, 255)  # branco

_RAIO_LANDMARK = 4
_RAIO_PIVO     = 9
_ESPESSURA     = 2
_ALTURA_BARRA  = 40


def _desenhar_esqueleto(frame, keypoints, largura, altura, idx_pivo):
    """Desenha o esqueleto neutro (in-place) e destaca o quadril-pivô."""
    for a, b in _POSE_CONNECTIONS:
        if a in _FACE_LANDMARKS or b in _FACE_LANDMARKS:
            continue
        kp_a = keypoints[a]
        kp_b = keypoints[b]
        if kp_a is None or kp_b is None:
            continue
        pt_a = (int(kp_a["x"] * largura), int(kp_a["y"] * altura))
        pt_b = (int(kp_b["x"] * largura), int(kp_b["y"] * altura))
        cv2.line(frame, pt_a, pt_b, COR_ESQUELETO, _ESPESSURA)

    for idx, kp in enumerate(keypoints):
        if kp is None or idx in _FACE_LANDMARKS:
            continue
        centro = (int(kp["x"] * largura), int(kp["y"] * altura))
        cv2.circle(frame, centro, _RAIO_LANDMARK, COR_ESQUELETO, -1)

    kp_pivo = keypoints[idx_pivo]
    if kp_pivo is not None:
        cp = (int(kp_pivo["x"] * largura), int(kp_pivo["y"] * altura))
        cv2.circle(frame, cp, _RAIO_PIVO, COR_PIVO, -1)
        cv2.circle(frame, cp, _RAIO_PIVO + 4, COR_PIVO, 2)


def _adicionar_titulo(frame, texto):
    """Retorna o frame com uma barra de título preta no topo."""
    largura = frame.shape[1]
    barra = np.zeros((_ALTURA_BARRA, largura, 3), dtype=np.uint8)
    cv2.putText(
        barra, texto, (10, 28),
        cv2.FONT_HERSHEY_SIMPLEX, 0.8, COR_TITULO, 2, cv2.LINE_AA,
    )
    return cv2.vconcat([barra, frame])


def _extrair_keypoints_video(video_path):
    """Roda o MediaPipe em todos os frames. Retorna lista de keypoints (ou None)."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    pose = inicializar_pose(static_image_mode=False)
    keypoints_por_frame = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        keypoints_por_frame.append(extrair_keypoints(pose.process(rgb)))
    pose.close()
    cap.release()
    return keypoints_por_frame


def _ler_frame_bgr(video_path, idx):
    """Reabre o vídeo e lê sequencialmente até o frame idx (robusto a seek de webm)."""
    cap = cv2.VideoCapture(video_path)
    frame_bgr = None
    i = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if i == idx:
            frame_bgr = frame
            break
        i += 1
    cap.release()
    return frame_bgr


def main():
    parser = argparse.ArgumentParser(
        description="Gera PNG lado a lado da correção de perspectiva."
    )
    parser.add_argument("video_path", help="caminho do vídeo de entrada")
    parser.add_argument(
        "-o", "--output", default="visualizacao_correcao.png",
        help="caminho do PNG de saída (default: visualizacao_correcao.png)",
    )
    parser.add_argument(
        "--frame", type=int, default=None,
        help="índice do frame (default: frame de maior θ)",
    )
    args = parser.parse_args()

    keypoints_por_frame = _extrair_keypoints_video(args.video_path)
    if keypoints_por_frame is None:
        print(f"Erro: não foi possível abrir o vídeo '{args.video_path}'.", file=sys.stderr)
        return 1
    if not any(kp is not None for kp in keypoints_por_frame):
        print("Erro: nenhuma pose detectada no vídeo.", file=sys.stderr)
        return 1

    try:
        side = detectar_lado(keypoints_por_frame)
    except ValueError as e:
        print(f"Erro ao detectar o lado da gravação: {e}", file=sys.stderr)
        return 1

    corrigidos = corrigir_perspectiva(keypoints_por_frame, side)
    thetas = estimar_thetas_por_frame(keypoints_por_frame, side)

    if args.frame is not None:
        idx = args.frame
        if not (0 <= idx < len(keypoints_por_frame)) or keypoints_por_frame[idx] is None:
            print(f"Erro: frame {idx} inválido ou sem pose detectada.", file=sys.stderr)
            return 1
    else:
        idx = max(
            (i for i, t in enumerate(thetas) if t is not None),
            key=lambda i: thetas[i],
        )

    theta_frame = thetas[idx]
    frame_bgr = _ler_frame_bgr(args.video_path, idx)
    if frame_bgr is None:
        print(f"Erro: não foi possível ler o frame {idx}.", file=sys.stderr)
        return 1

    altura, largura = frame_bgr.shape[:2]
    idx_pivo = QUADRIL_ESQ if side == "left" else QUADRIL_DIR

    painel_orig = frame_bgr.copy()
    painel_corr = frame_bgr.copy()
    _desenhar_esqueleto(painel_orig, keypoints_por_frame[idx], largura, altura, idx_pivo)
    _desenhar_esqueleto(painel_corr, corrigidos[idx], largura, altura, idx_pivo)

    painel_orig = _adicionar_titulo(painel_orig, "Original")
    painel_corr = _adicionar_titulo(painel_corr, f"Corrigido - theta={theta_frame:.1f} graus")

    composicao = cv2.hconcat([painel_orig, painel_corr])
    cv2.imwrite(args.output, composicao)
    print(
        f"Imagem salva em '{args.output}' "
        f"(frame {idx}, lado '{side}', theta={theta_frame:.1f} graus)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Verificar que o argparse/imports carregam**

Run: `cd backend && python scripts/visualizar_correcao_perspectiva.py --help`
Expected: imprime o help do argparse com `video_path`, `-o/--output`, `--frame`
(sem erro de import).

- [ ] **Step 3: Validar com um vídeo real**

Rode o script apontando para um vídeo lateral de exercício disponível
(substitua `CAMINHO_DO_VIDEO` pelo arquivo real):

Run: `cd backend && python scripts/visualizar_correcao_perspectiva.py CAMINHO_DO_VIDEO -o /tmp/correcao.png`
Expected: imprime `Imagem salva em '/tmp/correcao.png' (frame N, lado 'left'|'right', theta=X.X graus).`

Abra `/tmp/correcao.png` e confirme: dois painéis lado a lado, esqueleto neutro
em ambos, quadril-pivô dourado na mesma posição X nos dois painéis (a âncora não
se move), e o esqueleto corrigido com X expandido em relação ao original.

> Nota: se o único vídeo disponível for frontal, o script sairá com
> "Erro ao detectar o lado da gravação" — isso é esperado (correção de
> perspectiva só se aplica a gravações laterais). Use um vídeo lateral.

- [ ] **Step 4: Commit**

```bash
cd /home/bernardo/pose-analyzer
git add backend/scripts/visualizar_correcao_perspectiva.py
git commit -m "feat(scripts): script de visualização da correção de perspectiva"
```

---

## Self-Review (preenchido)

- **Spec coverage:** script standalone (Task 2) ✓; frame de maior θ (Task 1 +
  argmax na Task 2) ✓; layout lado a lado (Task 2 `hconcat`) ✓; agnóstico ao
  exercício (script não recebe exercício) ✓; destaque do quadril-pivô (Task 2
  `_desenhar_esqueleto`) ✓; funções existentes intocadas (Task 1 só adiciona) ✓;
  teste unitário da função pura (Task 1) ✓; validação manual do script (Task 2
  Step 3) ✓.
- **Placeholder scan:** sem TODO/TBD; todo código está completo (`CAMINHO_DO_VIDEO`
  é um placeholder de argumento de runtime fornecido pelo usuário, não código a
  preencher).
- **Type/nome consistency:** `estimar_thetas_por_frame` usado de forma idêntica
  no teste, na implementação e no script; `QUADRIL_ESQ`/`QUADRIL_DIR` conferem
  com `postural_checker.py` (23/24); helpers `_kp`/`_gerar_keypoints_base` já
  existem no arquivo de teste.
