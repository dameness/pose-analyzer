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
11 = ombro esquerdo     12 = ombro direito
13 = cotovelo esquerdo  14 = cotovelo direito
15 = pulso esquerdo     16 = pulso direito
23 = quadril esquerdo   24 = quadril direito
25 = joelho esquerdo    26 = joelho direito
27 = tornozelo esquerdo 28 = tornozelo direito
```

### `pipeline/angle_calculator.py`

Funções de cálculo geométrico. Puras — sem dependência de MediaPipe ou OpenCV.

Funções existentes (migradas do Colab):

- `calcular_angulo(p1, p2, p3) -> float`
  Recebe três keypoints (dicts com "x" e "y"), calcula o ângulo em graus
  na articulação p2 (vértice). Usa produto escalar via NumPy.
  Fórmula: arccos(dot(AB, CB) / (|AB| \* |CB|))

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
    angle_calculator.calcular_angulo() — para cada articulação relevante
        ↓
  agrega ângulos ao longo dos frames
        ↓
  postural_checker.verificar_{exercise}()
        ↓
  retorna dict de resultado
```

---

## Limiares posturais (estado atual — expandir conforme validação)

Os limiares abaixo são ponto de partida. Serão ajustados após validação
com especialistas de educação física e fisioterapia.

```python
# squat
JOELHO_MINIMO_SQUAT = 70    # graus no ponto mais baixo
JOELHO_MAXIMO_SQUAT = 100
QUADRIL_MINIMO_SQUAT = 80
# TODO: TORNOZELO_SQUAT — articulação prevista na spec, limiar pendente de validação

# pushup
COTOVELO_MINIMO_PUSHUP = 80
COTOVELO_MAXIMO_PUSHUP = 100
# TODO: OMBRO_PUSHUP e QUADRIL_PUSHUP — articulações previstas na spec, pendentes

# situp
QUADRIL_MINIMO_SITUP = 80
QUADRIL_MAXIMO_SITUP = 110
# TODO: COLUNA_SITUP — articulação prevista na spec, limiar pendente de validação
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
FRONTEND_DIST_PATH=../frontend/dist   # caminho do build do React
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
