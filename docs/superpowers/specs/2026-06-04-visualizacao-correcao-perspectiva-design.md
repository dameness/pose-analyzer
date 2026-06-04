# Visualização da correção de perspectiva — design

Data: 2026-06-04

## Objetivo

Gerar uma imagem (PNG) para documentação/TCC que ilustre o efeito do módulo
`backend/pipeline/perspective_corrector.py`. A imagem mostra, **lado a lado**, o
esqueleto MediaPipe original e o esqueleto após a correção de perspectiva,
plotados sobre o mesmo frame de um vídeo enviado sem formatação.

A ferramenta é um **script standalone**, rodado manualmente fora da API.

## Decisões de design

- **Formato:** script standalone (`backend/scripts/visualizar_correcao_perspectiva.py`).
- **Seleção de frame:** automática — o frame de **maior θ** (rotação mais visível),
  com override opcional via `--frame`.
- **Layout:** lado a lado (painel original | painel corrigido).
- **Agnóstico ao exercício:** a correção de perspectiva depende apenas do `side`
  (não do exercício). O script **não** recebe exercício — só caminho do vídeo.
- **Destaque do quadril-pivô:** o quadril do lado visível (âncora da correção, que
  não se move) é marcado com um marcador distinto, pois é o conceito-chave do módulo.
- **Funções existentes intocadas:** a nova função pública apenas compõe helpers
  privados já existentes; `corrigir_perspectiva` e `calcular_theta_medio` não mudam.

## Uso

```bash
python backend/scripts/visualizar_correcao_perspectiva.py video.mp4 -o saida.png [--frame 42]
```

## Componentes

### 1. Nova função pública em `perspective_corrector.py`

```python
estimar_thetas_por_frame(keypoints_por_frame, side) -> list[float | None]
```

Retorna o θ (em **graus**) já suavizado por EMA e clampado a `THETA_MAXIMO`,
por frame — exatamente o θ que `corrigir_perspectiva` aplica. Frames `None`
retornam `None` (passthrough), preservando o alinhamento de índices.

Implementação: compõe os helpers privados existentes sem alterá-los —
`_estimar_theta_frame`, `_aplicar_ema`, constante `THETA_MAXIMO`. A duplicação
de lógica raw→EMA→clamp em relação a `corrigir_perspectiva`/`calcular_theta_medio`
é aceita conscientemente para não tocar nessas funções.

O script usa o `argmax` dessa lista (ignorando `None`) para escolher o frame.
Como o θ é o mesmo já aplicado em `corrigir_perspectiva`, e o script processa o
vídeo inteiro (não um frame isolado), o resultado bate com o pipeline real —
evitando a degeneração da EMA que aconteceria ao processar um único frame.

### 2. Script `backend/scripts/visualizar_correcao_perspectiva.py`

Fluxo:

1. `argparse`: `video_path` (posicional), `-o/--output` (default
   `visualizacao_correcao.png`), `--frame` (int opcional, override).
2. Abre o vídeo com OpenCV, roda MediaPipe (`inicializar_pose(static_image_mode=False)`)
   frame a frame, `extrair_keypoints` → lista `keypoints_por_frame`.
3. `detectar_lado(keypoints_por_frame)` → `side`. Se `ValueError` (gravação frontal
   ou poucos frames), imprime mensagem amigável e sai com código != 0.
4. `corrigir_perspectiva(keypoints_por_frame, side)` → keypoints corrigidos.
5. `estimar_thetas_por_frame(keypoints_por_frame, side)` → escolhe o índice de maior
   θ (ou usa `--frame` se fornecido).
6. Faz seek do frame BGR escolhido no vídeo (`cap.set(cv2.CAP_PROP_POS_FRAMES, idx)`).
7. Desenha o esqueleto em duas cópias do frame: original (keypoints originais) e
   corrigido (keypoints corrigidos), ambos com `_desenhar_esqueleto`.
8. Adiciona barra de título em cada painel ("Original" / "Corrigido — θ=XX.X°").
9. `cv2.hconcat` dos dois painéis e `cv2.imwrite` do PNG.

### 3. Helper local de desenho `_desenhar_esqueleto`

No próprio script. Usa `cv2.line`/`cv2.circle` sobre `mp.solutions.pose.POSE_CONNECTIONS`,
ignorando landmarks de face (`range(11)`), com cor neutra para arestas/landmarks.
Recebe o índice do quadril-pivô e o desenha com marcador distinto (cor/raio diferente).

Não reusa `video_annotator._anotar_frame` porque aquele é acoplado a
`joint_results`/coloração postural; para ilustrar geometria, esqueleto neutro é
mais claro.

## Dependências

Nenhuma nova. `cv2`, `numpy`, `mediapipe` já estão em `requirements.txt`.

## Testes

- `estimar_thetas_por_frame` é pura → teste unitário: sequência de keypoints
  conhecida, verifica suavização EMA, clamp em `THETA_MAXIMO` e passthrough de `None`.
- O script (I/O de imagem) é validado rodando em um vídeo real e inspecionando o PNG.

## Fora de escopo

- Coloração postural (correto/incorreto) — é sobre outro módulo.
- Integração com a API / endpoint.
- Animação ou vídeo do antes/depois.
