# Backend — Pose Analyzer

Leia também o `CLAUDE.md` na raiz do projeto para contexto geral.

---

## Stack

- Python 3.11+
- FastAPI + Uvicorn
- MediaPipe 0.10.20 (versão fixada — não atualizar)
- OpenCV (`opencv-python-headless` — sem GUI)
- NumPy
- Pydantic v2 (vem com FastAPI)
- PyAV (`av`) — encoding H.264 para o vídeo anotado (empacota FFmpeg próprio)

---

## O que já existe (código do Colab refatorado)

O código original do Colab foi migrado para os seguintes módulos.
Entenda o que cada um faz antes de modificar qualquer coisa.

### `pipeline/mediapipe_runner.py`

Responsável por inicializar o MediaPipe Pose e processar imagens.

Funções existentes (migradas do Colab):

- `inicializar_pose(static_image_mode: bool) -> mp.solutions.pose.Pose`
  Cria e retorna a instância do Pose. `static_image_mode=True` para imagens,
  `False` para vídeos (melhor performance em sequências de frames).
- `extrair_keypoints(results) -> list[dict] | None`
  Recebe o retorno do MediaPipe e retorna lista de 33 pontos
  `[{"x": float, "y": float, "z": float, "visibility": float}]`.
  Retorna `None` se nenhuma pose for detectada.

Índices dos keypoints relevantes (padrão MediaPipe):

```
 0 = nariz
11 = ombro esquerdo     12 = ombro direito
13 = cotovelo esquerdo  14 = cotovelo direito
15 = pulso esquerdo     16 = pulso direito
23 = quadril esquerdo   24 = quadril direito
25 = joelho esquerdo    26 = joelho direito
27 = tornozelo esquerdo 28 = tornozelo direito
31 = índice pé esquerdo 32 = índice pé direito
```

### `pipeline/angle_calculator.py`

Funções de cálculo geométrico. Puras — sem dependência de MediaPipe ou OpenCV.

Funções existentes (migradas do Colab):

- `calcular_angulo(p1, p2, p3) -> float`
  Recebe três keypoints (dicts com "x" e "y"), calcula o ângulo em graus
  na articulação p2 (vértice). Usa produto escalar via NumPy.
  Fórmula: arccos(dot(AB, CB) / (|AB| \* |CB|))

### `pipeline/side_detector.py`

Detecção automática do lado de gravação (esquerdo, direito ou frontal).
Analisa a visibilidade dos keypoints pareados (esquerdo vs direito) ao longo
de múltiplos frames para determinar de qual lado o usuário foi gravado.

Função:

- `detectar_lado(keypoints_por_frame) -> str`
  Retorna `"left"` ou `"right"`. Levanta `ValueError` se a gravação for
  frontal (visibilidade semelhante em ambos os lados) ou se houver poucos
  frames com pose detectada.

Algoritmo:

1. Para cada frame, calcula a média de visibilidade dos 5 pares de keypoints
   (ombro, cotovelo, quadril, joelho, tornozelo) de cada lado
2. Calcula a razão `média_esq / média_dir` por frame
3. Toma a **mediana** das razões (robusta contra outliers)
4. Se `mediana > RATIO_LIMIAR` → esquerdo; se `< 1/RATIO_LIMIAR` → direito;
   caso contrário → frontal (ValueError)

Constantes de configuração:

```python
RATIO_LIMIAR = 1.4          # razão mínima para considerar um lado dominante
_MIN_FRAMES_DETECCAO = 5    # mínimo de frames válidos para decidir
```

**Importante:** gravações frontais são rejeitadas com `ValueError`, que o
handler de exceções em `main.py` mapeia automaticamente para
`error_type: "validation_error"`. Não é necessário alterar `main.py`.

### `pipeline/perspective_corrector.py`

Correção de perspectiva — estima o ângulo de rotação horizontal do corpo (θ)
e corrige as coordenadas X dos keypoints antes do cálculo de ângulos.

**Por que isso é necessário:** O pipeline calcula ângulos articulares em 2D
usando apenas X e Y dos keypoints. Isso assume que o usuário está perfeitamente
de lado para a câmera (90° em relação ao eixo óptico). Na prática, existe uma
tolerância de visibilidade no `side_detector` (`RATIO_LIMIAR = 1.4`) que aceita
gravações com desvios de até ~35°. Nesses casos, o eixo de profundidade é
projetado no eixo X, comprimindo as distâncias horizontais e distorcendo os
ângulos calculados — um joelho perfeitamente flexionado em 90° pode aparentar
85° apenas por conta da rotação. A correção reconstrói as posições horizontais
"como se" o usuário estivesse perfeitamente lateral.

Funções públicas:

- `corrigir_perspectiva(keypoints_por_frame, side) -> list[list[dict] | None]`
  Retorna uma **nova** lista com coordenadas X corrigidas — não altera a original.
  Frames `None` passam sem alteração. Cada keypoint dict mantém todos os campos
  (`x`, `y`, `z`, `visibility`), com apenas `x` modificado.

- `calcular_theta_medio(keypoints_por_frame, side) -> float`
  Retorna o θ médio em graus para os frames analisados. Usado no campo
  `perspective_correction.mean_theta_degrees` do resultado da API.

Algoritmo de estimação de θ (híbrido, por frame):

1. **Sinal Z (primário):** `θ_z = atan2(hip_near.z − hip_far.z, body_width_estimate)`
   — diferença de profundidade entre o quadril do lado visível e o oposto.
2. **Sinal X (estabilizador):** `θ_x = asin(|ombro_esq.x − ombro_dir.x| / ref_shoulder_width)`
   — separação horizontal entre ombros; compensa o ruído do Z do MediaPipe.
3. **Blend ponderado:** `θ = z_conf × θ_z + (1 − z_conf) × θ_x`
   — quando Z é ruidoso (oclusão, movimento rápido), o peso migra para θ_x.
4. **EMA:** `θ_smoothed[t] = α × θ_raw[t] + (1 − α) × θ_smoothed[t−1]`
   — suaviza jitter inter-frame.
5. **Clamp:** `θ_final = clamp(θ_smoothed, 0, THETA_MAXIMO)`

Correção X (ancorada no quadril near-side):

```python
x_corrected = x_quadril + (x_original − x_quadril) / cos(θ)
```

O quadril do lado visível é o pivô — não se move. Os demais pontos expandem
proporcionalmente. Y, Z e visibility são preservados.

Constantes de configuração (topo do arquivo):

```python
ALPHA_EMA           = 0.3               # fator de suavização EMA
THETA_MAXIMO        = math.radians(35)  # rotação máxima corrigível
RATIO_LARGURA_OMBRO = 0.55              # largura ombro / altura torso
RATIO_LARGURA_QUADRIL = 0.45            # largura quadril / altura torso
FATOR_RUIDO_Z       = 10.0              # escala o ruído Z na fórmula de confiança
```

**Posição no pipeline:** entre `detectar_lado()` e `detectar_inicio_movimento()`.
O `video_annotator` recebe os keypoints originais (pré-correção) para desenhar
o esqueleto sobre o vídeo real. Todos os outros módulos downstream recebem
os keypoints corrigidos.

### `pipeline/movement_detector.py`

Pré-processamento — detecta onde o exercício começa e termina no vídeo,
descartando frames ociosos no início e no final da gravação.

Funções:

- `detectar_inicio_movimento(keypoints_por_frame, exercise, side="left") -> int`
  Retorna o índice do primeiro frame relevante. Combina dois sinais:
  1. **Ângulo:** primeiro trecho de 5 frames consecutivos com queda acumulada >= 15°
     na articulação primária do exercício (série suavizada com moving average).
  2. **Orientação:** primeiro frame onde o usuário está corretamente de lado
     (razão de visibilidade satisfaz `RATIO_LIMIAR` por `FRAMES_CONSECUTIVOS` seguidos).
     Retorna `max(inicio_angulo, inicio_orientacao)`.
- `detectar_fim_movimento(keypoints_por_frame, exercise, side="left") -> int`
  Retorna o índice (exclusivo) do último frame relevante. Combina:
  1. **Ângulo:** último trecho com variação angular significativa (varredura de trás
     para frente na série suavizada).
  2. **Orientação:** último frame onde o usuário ainda está corretamente de lado.
     Retorna `min(fim_angulo, fim_orientacao)`.

O parâmetro `side` (`"left"` ou `"right"`) determina quais keypoints são
usados para o ângulo (via `KEYPOINTS_POR_LADO`) e para a verificação de
orientação (via `RATIO_LIMIAR` importado de `side_detector.py`).

Funções internas relevantes:

- `_frame_orientacao_valida(keypoints, side) -> bool`
  Verifica se a razão de visibilidade do frame satisfaz `RATIO_LIMIAR` para o lado.
  Usa os mesmos 5 pares de keypoints do `side_detector` (ombro, cotovelo, quadril,
  joelho, tornozelo).
- `_encontrar_janela_orientacao(keypoints_por_frame, side) -> tuple[int, int]`
  Retorna `(inicio, fim)` da janela com orientação válida. Exige
  `FRAMES_CONSECUTIVOS` frames seguidos para declarar início/fim (robusto contra
  jitter). Fallback: `(0, total)` quando não consegue determinar.

Constantes de configuração (topo do arquivo):

```python
JANELA_SUAVIZACAO = 5         # moving average para filtrar jitter
FRAMES_CONSECUTIVOS = 5       # frames seguidos na janela de detecção
DELTA_ACUMULADO_MINIMO = 15.0 # graus de variação mínima para considerar movimento
LOOKBACK_FRAMES = 3           # margem de segurança antes/depois do ponto detectado
```

Articulação primária por exercício (a que mais muda durante o movimento):

- squat → joelho (quadril → joelho → tornozelo)
- pushup → cotovelo (ombro → cotovelo → pulso)
- situp → quadril (ombro → quadril → joelho)

Os índices concretos são resolvidos em runtime pela função interna
`_articulacao_primaria(exercise, side)` com base no `KEYPOINTS_POR_LADO`.

**Importante:** não colocar lógica de limiares posturais neste módulo —
ele trata apenas da detecção temporal (quando começa/termina), não da
correção do movimento.

### `pipeline/postural_checker.py`

Lógica de negócio — define o que é correto/incorreto para cada exercício.
Este é o módulo que mais vai crescer ao longo do projeto.

Estrutura:

- Uma função por exercício: `verificar_squat`, `verificar_situp`, `verificar_pushup`
- Cada função recebe a lista de keypoints e `side` (`"left"` ou `"right"`, default `"left"`)
  e retorna um dict com resultado por articulação
- Os limiares de ângulo (ex: joelho deve estar entre 80° e 100° no ponto baixo)
  devem ser constantes nomeadas no topo do arquivo, não números mágicos
- `KEYPOINTS_POR_LADO` mapeia `"left"`/`"right"` → nomes abstratos de articulação →
  índices concretos de keypoints MediaPipe. As funções de verificação usam esse
  mapeamento para selecionar os keypoints do lado correto
- `verificar_exercicio(exercise, keypoints_por_frame, side="left")` é o dispatcher

**Importante — keys do resultado em inglês:**
Os dicts `joint_angles` e `joint_results` retornados pela API devem usar keys em inglês,
pois o front-end faz a tradução para exibição. Mapeamento:

```python
# squat / situp
"knee"    # joelho
"hip"     # quadril
"ankle"   # tornozelo
"spine"   # coluna

# pushup
"elbow"   # cotovelo
"shoulder" # ombro
"hip"     # quadril
```

### `pipeline/video_processor.py`

Orquestra o pipeline completo para um arquivo de vídeo.

Função principal:

- `processar_video(video_path: str, exercise: str, annotated_output_path: str | None = None) -> dict`
  Abre o vídeo com OpenCV, itera frame a frame, chama o MediaPipe,
  extrai keypoints, detecta o lado da gravação (levanta `ValueError` se frontal),
  aplica correção de perspectiva nos keypoints, detecta o movimento,
  calcula ângulos e verifica postura usando os keypoints corrigidos do lado detectado.
  Se `annotated_output_path` for fornecido, chama `anotar_video()` ao final
  antes de retornar (usando os keypoints originais, sem correção).
  Retorna o dict completo de resultado conforme o contrato da API
  (inclui `detected_side` e `perspective_correction`).

### `pipeline/video_annotator.py`

Gera o vídeo anotado com esqueleto MediaPipe e articulações coloridas.

Função principal:

- `anotar_video(video_path, keypoints_completos, joint_results, exercise, fps, frame_inicio, frame_fim, output_path, side="left") -> None`
  Re-lê o vídeo original frame a frame. Para frames dentro de
  `[frame_inicio, frame_fim)` chama `_anotar_frame()`. Frames fora do
  intervalo são copiados sem anotação. Usa PyAV para gravar em H.264
  (necessário para reprodução no browser).

**Estratégia de anotação por articulação (`_anotar_frame`):**

Cada articulação é definida por uma tripla `(p1, vértice, p3)`. Para cada frame,
o anotador desenha nessa ordem (back → front):

1. Arestas das articulações **corretas** — ambas as pernas do ângulo (p1→vértice e vértice→p3) coloridas
2. Arestas das articulações **incorretas** — idem, sobrescrevem sobreposições
3. Arestas neutras — demais conexões POSE_CONNECTIONS em cinza
4. Landmarks neutros — todos em cinza (referência visual)
5. **Anel** colorido ao redor do vértice (`_RAIO_ANEL = 14px`; espessura 3 se incorreto, 2 se correto)
6. Ponto interno colorido no vértice
7. **Label de ângulo** — valor em graus, offset perpendicular à linha p1→p3 (`_OFFSET_LABEL = 60px`)
   - OpenCV não suporta Unicode; o símbolo `°` é simulado por um pequeno círculo desenhado ao lado do número

Quando dois joints compartilham uma aresta (ex: quadril e joelho dividem o segmento fêmur),
o **incorreto vence** porque é desenhado por último (`_construir_info_articulacoes` ordena
corretos antes de incorretos).

**Triplas por exercício** (`_TRIPLAS_POR_EXERCICIO`):

```python
"squat":  {"knee": ("quadril","joelho","tornozelo"), "hip": ("ombro","quadril","joelho"), "ankle": ("joelho","tornozelo","indice_pe")}
"pushup": {"elbow": ("ombro","cotovelo","pulso"), "shoulder": ("cotovelo","ombro","quadril"), "hip": ("ombro","quadril","joelho")}
"situp":  {"hip": ("ombro","quadril","joelho")}
# situp/spine: caso especial bilateral — vértice = midpoint(OMBRO_ESQ, OMBRO_DIR),
#              p1 = NARIZ, p3 = midpoint(QUADRIL_ESQ, QUADRIL_DIR)
```

As chaves de partes do corpo são resolvidas para índices de landmark concretos via
`KEYPOINTS_POR_LADO[side]` de `postural_checker.py`.

### `main.py`

FastAPI com três endpoints (`POST /analyze`, `GET /status/{job_id}`, `GET /video/{job_id}`).
Jobs em memória (dict). Pipeline executado em thread separada via `threading.Thread`.
Em produção futura, substituir por Celery + Redis.
Serve os arquivos estáticos do front-end buildado (`frontend/dist/`) na rota `/`.

O vídeo anotado é salvo em arquivo temporário via `tempfile.mkstemp` e persiste
enquanto o processo estiver rodando. **Não é deletado automaticamente** — reiniciar
o servidor limpa os arquivos temporários do SO. Não usar `mktemp` (deprecated).

**Validação síncrona no `/analyze`:**

`POST /analyze` valida dois campos antes de enfileirar o job:

- `exercise` — verificado contra `_EXERCICIOS_VALIDOS`. Se inválido, retorna **422** imediatamente.
- `video` (content-type ou extensão) — verificado contra `_CONTENT_TYPES_VALIDOS` e `_EXTENSOES_VALIDAS`.
  Se não reconhecido, retorna **415** imediatamente.

`_EXERCICIOS_VALIDOS` deve ser mantido em sincronia com o dict `VERIFICADORES` em
`pipeline/postural_checker.py`. Ao adicionar um novo exercício, atualizar **ambos**.

Jobs criados com sucesso retornam **202 Accepted**.

**Categorização de erros na thread de processamento:**

O handler de exceções da thread diferencia três tipos:

| Exceção        | `error_type`       | Causa típica                                            |
| -------------- | ------------------ | ------------------------------------------------------- |
| `ValueError`   | `validation_error` | Vídeo muito longo, exercício inválido, gravação frontal |
| `RuntimeError` | `invalid_file`     | OpenCV não conseguiu abrir o vídeo                      |
| `Exception`    | `processing_error` | Erros inesperados de pipeline                           |

O campo `error_type` é retornado junto com `message` no `GET /status/{job_id}`.

---

## Fluxo interno do pipeline

```
video_path + exercise + annotated_output_path
        ↓
video_processor.processar_video()
        ↓
  para cada frame:
    OpenCV lê o frame
    mediapipe_runner.extrair_keypoints()
        ↓
  side_detector.detectar_lado()   ← retorna "left"/"right" ou ValueError se frontal
        ↓
  salva keypoints_completos (originais, pré-correção — usados pelo annotator)
        ↓
  perspective_corrector.corrigir_perspectiva(side=side)
  ← estima θ por frame (Z + X híbrido), suaviza EMA, clamp 35°,
    corrige X via x_quadril + (x − x_quadril) / cos(θ)
        ↓
  movement_detector.detectar_inicio_movimento(side=side)
  movement_detector.detectar_fim_movimento(side=side)
  recorta keypoints_por_frame[inicio:fim]
        ↓
  calcula confiança e conta frames analisados
        ↓
  postural_checker.verificar_{exercise}(side=side)
        ↓
  [se annotated_output_path]
  video_annotator.anotar_video()   ← re-lê vídeo, desenha com PyAV/H.264
        ↓
  retorna dict de resultado (inclui trimmed_start, trimmed_end, detected_side, video_url)
```

---

## Limiares posturais (estado atual — ajustar após validação com especialistas)

Os limiares abaixo são ponto de partida. Serão ajustados após validação
com especialistas de educação física e fisioterapia.

```python
# squat
JOELHO_MINIMO_SQUAT    = 30    # graus no ponto mais baixo
JOELHO_MAXIMO_SQUAT    = 80
QUADRIL_MINIMO_SQUAT   = 45
TORNOZELO_MINIMO_SQUAT = 60    # dorsiflexão mínima no ponto mais baixo
TORNOZELO_MAXIMO_SQUAT = 90

# pushup
COTOVELO_MINIMO_PUSHUP = 80
COTOVELO_MAXIMO_PUSHUP = 100
OMBRO_MINIMO_PUSHUP    = 30    # ângulo cotovelo→ombro→quadril na descida
OMBRO_MAXIMO_PUSHUP    = 70
QUADRIL_MINIMO_PUSHUP  = 160   # quadril deve estar estendido (corpo reto)

# situp
QUADRIL_MINIMO_SITUP   = 40
QUADRIL_MAXIMO_SITUP   = 125
COLUNA_MINIMO_SITUP    = 60    # ângulo nariz→centro_ombros→centro_quadris na subida
COLUNA_MAXIMO_SITUP    = 120
```

---

## Como rodar em desenvolvimento

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## Variáveis de ambiente

```bash
# backend/.env
# Origins permitidas pelo CORS — necessário apenas em desenvolvimento
# Em produção o front é servido pelo próprio FastAPI; CORS não se aplica
ALLOWED_ORIGINS=http://localhost:5173

# Duração máxima de vídeo aceita (segundos)
MAX_VIDEO_DURATION_SECONDS=30
```

---

## requirements.txt esperado

```
fastapi
uvicorn[standard]
python-multipart
mediapipe==0.10.20
opencv-python-headless
numpy
python-dotenv
av
```

**Nota sobre codecs de vídeo:** `opencv-python-headless` não inclui H.264.
O único codec MP4 disponível pelo OpenCV neste ambiente é `mp4v` (MPEG-4 Part 2),
que browsers modernos não reproduzem. Por isso o vídeo anotado usa PyAV (`av`)
que empacota seu próprio FFmpeg com suporte a H.264.

---

## O que NÃO fazer

- Não usar `mediapipe` com `static_image_mode=True` para processar vídeos —
  é muito mais lento do que `False`
- Não inicializar o MediaPipe Pose dentro do loop de frames —
  inicializar uma vez fora do loop e reutilizar
- Não salvar frames intermediários em disco — processar em memória
- Não colocar lógica de limiares posturais em `video_processor.py` —
  ela pertence ao `postural_checker.py`
- Não usar `requirements.txt` com versões sem pin para o mediapipe —
  a API muda entre versões menores
- Não usar `cv2.VideoWriter` com codec `mp4v` para vídeos destinados ao browser —
  usar PyAV com `h264` (veja `video_annotator.py`)
- Não usar `tempfile.mktemp` (deprecated) — usar `tempfile.mkstemp` e fechar o fd:
  `fd, path = tempfile.mkstemp(suffix=".mp4"); os.close(fd)`
