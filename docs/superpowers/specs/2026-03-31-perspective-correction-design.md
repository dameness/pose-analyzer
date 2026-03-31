# Correção de Perspectiva — Keypoint Rotation Correction

**Data:** 2026-03-31
**Status:** Aprovado
**Contexto:** O pipeline calcula ângulos posturais em 2D (X, Y) assumindo que o
usuário está perfeitamente de lado para a câmera. Quando há rotação parcial do
corpo (até ~35°), a projeção 2D comprime o eixo de profundidade, distorcendo os
ângulos calculados. Esta feature corrige essa distorção.

---

## Problema

O side_detector aceita vídeos com um limiar de visibilidade (RATIO_LIMIAR = 1.4),
permitindo gravações que não são perfeitamente laterais. Nessas gravações, as
coordenadas X dos keypoints são comprimidas pela projeção perspectiva, gerando
ângulos articulares imprecisos. A correção é mais relevante na faixa de 15-35°
de rotação, onde os vídeos passam pelo side detector mas o erro de projeção é
não-trivial.

## Solução

Novo módulo `pipeline/perspective_corrector.py` que estima o ângulo de rotação
do corpo (θ) e corrige as coordenadas X antes que o restante do pipeline
as processe.

---

## 1. Interface do Módulo e Integração no Pipeline

### Função pública

```python
def corrigir_perspectiva(
    keypoints_por_frame: list[list[dict] | None],
    side: str,
) -> list[list[dict] | None]:
```

- Recebe os keypoints brutos e o lado detectado
- Retorna uma **nova** lista com coordenadas X corrigidas (não altera a original)
- Frames `None` passam como `None`
- Cada dict de keypoint mantém todos os campos (`x`, `y`, `z`, `visibility`),
  com apenas `x` modificado

### Posição no pipeline

```
detect side → corrigir_perspectiva() → detect movement → postural checker
```

Inserido em `video_processor.py` entre a detecção de lado e a detecção de
movimento. Os keypoints corrigidos substituem os brutos para toda a análise
downstream. A lista original `keypoints_completos` (usada para anotação do
vídeo) permanece inalterada — o esqueleto anotado reflete as posições reais
do vídeo.

---

## 2. Algoritmo de Estimação de θ

### Dois sinais combinados (híbrido)

**Sinal A — Baseado em Z (primário):**

```python
θ_z = atan2(hip_near.z - hip_far.z, body_width_estimate)
```

Onde `hip_near` é o quadril do lado detectado (mais visível, voltado para a
câmera) e `hip_far` é o do lado oposto.

**Sinal B — Separação em X (estabilizador):**

```python
θ_x = asin(clamp(|shoulder_left.x - shoulder_right.x| / reference_shoulder_width, -1, 1))
```

### Valores de referência derivados do torso

Calculados por frame a partir da altura do torso do lado mais visível:

```python
torso_height = |shoulder_near.y - hip_near.y|
reference_shoulder_width = torso_height * RATIO_LARGURA_OMBRO    # 0.55
body_width_estimate      = torso_height * RATIO_LARGURA_QUADRIL  # 0.45
```

Rationale: adapta-se automaticamente ao tamanho do corpo e à distância da
câmera, sem fase de calibração.

### Blend ponderado por confiança

```python
z_noise = std_dev(z values dos 5 keypoints pareados do lado próximo: ombro, cotovelo, quadril, joelho, tornozelo)
z_confidence = 1 / (1 + z_noise * FATOR_RUIDO_Z)
θ_raw = z_confidence * θ_z + (1 - z_confidence) * θ_x
```

Quando Z é ruidoso (oclusão, movimento rápido), o peso migra para θ_x.

### Suavização EMA entre frames

```python
θ_smoothed[0] = θ_raw[0]
θ_smoothed[t] = α * θ_raw[t] + (1 - α) * θ_smoothed[t-1]
```

### Clamping

```python
θ_final = clamp(θ_smoothed, 0, THETA_MAXIMO)
```

Frames com θ acima do máximo são corrigidos até o limite (não descartados),
evitando lacunas na análise.

### Constantes configuráveis

```python
ALPHA_EMA              = 0.3               # fator de suavização EMA
THETA_MAXIMO           = math.radians(35)  # rotação máxima corrigível
RATIO_LARGURA_OMBRO    = 0.55              # largura ombro / altura torso
RATIO_LARGURA_QUADRIL  = 0.45              # largura quadril / altura torso
FATOR_RUIDO_Z          = 10.0              # escala o ruído Z na fórmula de confiança
```

---

## 3. Correção das Coordenadas X

### Fórmula

```python
x_corrected = x_center + (x_original - x_center) / cos(θ)
```

Onde `x_center` é a coordenada X do quadril do lado próximo (near-side hip) —
o landmark mais estável, usado como ponto de ancoragem.

### Por que ancorar no quadril?

Em vista lateral, o quadril do lado visível é o landmark mais confiável e
serve como pivô natural. Os demais pontos expandem proporcionalmente ao
redor dele. Ancorar em um ponto arbitrário deslocaria o esqueleto inteiro.

### O que não muda

- **Y:** não é comprimido por rotação ao redor do eixo vertical
- **Z e visibility:** preservados no output

### Casos-limite

- `cos(θ) = 0` não ocorre — θ é clamped a 35° (cos(35°) ≈ 0.82)
- Frame com keypoints `None` → passa sem alteração
- Torso height ≈ 0 (detecção degenerada) → frame passa sem correção

---

## 4. Testes

### Arquivo: `test_perspective_corrector.py`

**Estimação de θ:**
- Vista lateral perfeita (ΔZ ≈ 0, separação X ≈ 0) → θ ≈ 0
- Rotação conhecida (keypoints sintéticos com offset Z controlado) → θ esperado
- Frame com Z ruidoso → confiança migra para θ_x
- θ_z e θ_x divergentes → blend produz valor razoável

**Correção:**
- θ = 0 → X de saída == X de entrada
- θ = 20° → valores X expandem por 1/cos(20°) relativo ao quadril
- Quadril do lado próximo não se move após correção
- Y inalterado em todos os casos
- Frames `None` passam como `None`

**Clamping:**
- θ_raw > 35° → clamped a 35°
- θ_raw < 0° → clamped a 0°

**EMA:**
- Sequência constante → converge para o valor
- Spike → EMA amortece

**Integração:**
- Torso height degenerado → frame passa sem correção
- Pipeline completo com keypoints sintéticos → ângulos corrigidos diferem dos
  brutos na direção esperada

**Testes existentes não são alterados** — o corrector é um estágio novo com
módulo próprio.

---

## 5. Contrato da API

### Adição ao resultado

Campo novo no dict de resultado do `processar_video`:

```json
{
  "detected_side": "left",
  "perspective_correction": {
    "mean_theta_degrees": 12.3,
    "applied": true
  }
}
```

- `mean_theta_degrees`: θ médio (em graus) nos frames analisados
- `applied`: sempre `true` quando o corrector executa

**Aditivo** — nenhum campo existente muda. Nenhuma alteração no frontend é
necessária. O frontend pode opcionalmente exibir essa info no futuro.

**Sem novos tipos de erro** — frames degenerados são tratados gracefully
(passam sem correção).
