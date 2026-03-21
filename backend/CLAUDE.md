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

### `pipeline/movement_detector.py`

Pré-processamento — detecta onde o exercício começa e termina no vídeo,
descartando frames ociosos no início e no final da gravação.

Funções:

- `detectar_inicio_movimento(keypoints_por_frame, exercise) -> int`
  Retorna o índice do primeiro frame relevante. Calcula o ângulo da
  articulação primária do exercício em cada frame, suaviza com moving
  average (janela=5), e procura o primeiro trecho de 5 frames consecutivos
  com queda acumulada >= 15°. Retorna 0 se nenhum movimento for detectado.
- `detectar_fim_movimento(keypoints_por_frame, exercise) -> int`
  Retorna o índice (exclusivo) do último frame relevante. Varre a série
  suavizada de trás para frente procurando o último trecho com variação
  angular significativa. Retorna `len(keypoints_por_frame)` se não houver
  idle no final.

Constantes de configuração (topo do arquivo):

```python
JANELA_SUAVIZACAO = 5         # moving average para filtrar jitter
FRAMES_CONSECUTIVOS = 5       # frames seguidos na janela de detecção
DELTA_ACUMULADO_MINIMO = 15.0 # graus de variação mínima para considerar movimento
LOOKBACK_FRAMES = 3           # margem de segurança antes/depois do ponto detectado
```

Articulação primária por exercício (a que mais muda durante o movimento):

- squat → joelho (QUADRIL_ESQ → JOELHO_ESQ → TORNOZELO_ESQ)
- pushup → cotovelo (OMBRO_ESQ → COTOVELO_ESQ → PULSO_ESQ)
- situp → quadril (OMBRO_ESQ → QUADRIL_ESQ → JOELHO_ESQ)

**Importante:** não colocar lógica de limiares posturais neste módulo —
ele trata apenas da detecção temporal (quando começa/termina), não da
correção do movimento.

### `pipeline/postural_checker.py`

Lógica de negócio — define o que é correto/incorreto para cada exercício.
Este é o módulo que mais vai crescer ao longo do TCC.

Estrutura esperada:

- Uma função por exercício: `verificar_squat`, `verificar_situp`, `verificar_pushup`
- Cada função recebe a lista de keypoints e retorna um dict com resultado por articulação
- Os limiares de ângulo (ex: joelho deve estar entre 80° e 100° no ponto baixo)
  devem ser constantes nomeadas no topo do arquivo, não números mágicos

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

- `processar_video(video_path: str, exercise: str) -> dict`
  Abre o vídeo com OpenCV, itera frame a frame, chama o MediaPipe,
  extrai keypoints, calcula ângulos e verifica postura.
  Retorna o dict completo de resultado conforme o contrato da API.

### `main.py`

FastAPI com dois endpoints (`POST /analyze`, `GET /status/{job_id}`).
Jobs em memória (dict). Pipeline executado em thread separada via `threading.Thread`.
Em produção futura, substituir por Celery + Redis.
Serve os arquivos estáticos do front-end buildado (`frontend/dist/`) na rota `/`.

---

## Fluxo interno do pipeline

```
video_path + exercise
        ↓
video_processor.processar_video()
        ↓
  para cada frame:
    OpenCV lê o frame
    mediapipe_runner.extrair_keypoints()
        ↓
  movement_detector.detectar_inicio_movimento()
  movement_detector.detectar_fim_movimento()
  recorta keypoints_por_frame[inicio:fim]
        ↓
  calcula confiança e conta frames analisados
        ↓
  postural_checker.verificar_{exercise}()
        ↓
  retorna dict de resultado (inclui trimmed_start e trimmed_end)
```

---

## Limiares posturais (estado atual — ajustar após validação com especialistas)

Os limiares abaixo são ponto de partida. Serão ajustados após validação
com especialistas de educação física e fisioterapia.

```python
# squat
JOELHO_MINIMO_SQUAT    = 70    # graus no ponto mais baixo
JOELHO_MAXIMO_SQUAT    = 100
QUADRIL_MINIMO_SQUAT   = 80
TORNOZELO_MINIMO_SQUAT = 60    # dorsiflexão mínima no ponto mais baixo
TORNOZELO_MAXIMO_SQUAT = 90

# pushup
COTOVELO_MINIMO_PUSHUP = 80
COTOVELO_MAXIMO_PUSHUP = 100
OMBRO_MINIMO_PUSHUP    = 30    # ângulo cotovelo→ombro→quadril na descida
OMBRO_MAXIMO_PUSHUP    = 70
QUADRIL_MINIMO_PUSHUP  = 160   # quadril deve estar estendido (corpo reto)

# situp
QUADRIL_MINIMO_SITUP   = 80
QUADRIL_MAXIMO_SITUP   = 110
COLUNA_MINIMO_SITUP    = 60    # ângulo nariz→centro_ombros→centro_quadris na subida
COLUNA_MAXIMO_SITUP    = 120
```

---

## Como rodar em desenvolvimento

```bash
cd backend
python -m venv venv
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
```

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
