# Pose Analyzer — TCC Bernardo Damiani

## Visão geral

Sistema de análise postural de exercícios físicos usando MediaPipe.
O usuário seleciona um exercício, envia um vídeo, e recebe feedback
visual indicando quais articulações estão corretas ou com erros posturais.

**Projeto acadêmico:** TCC de Bacharelado em Ciência da Computação —
Instituto Federal Sul-rio-grandense, Câmpus Passo Fundo.

---

## Estrutura do monolito

```
pose-analyzer/
  backend/
    main.py                  # FastAPI — ponto de entrada, serve API + frontend buildado
    pipeline/
      __init__.py
      mediapipe_runner.py    # inicializa o Pose, processa frames, extrai keypoints
      angle_calculator.py    # calcular_angulo() — lógica de ângulos entre keypoints
      postural_checker.py    # lógica de correto/incorreto por exercício e articulação
      video_processor.py     # lê vídeo frame a frame via OpenCV, orquestra o pipeline
    models/
      __init__.py
      schemas.py             # Pydantic models para request/response da API
    CLAUDE.md                # instruções específicas do back-end
    requirements.txt

  frontend/
    src/
      types/index.ts         # interfaces TypeScript — fonte da verdade dos tipos
      services/api.ts        # submitVideo() e getStatus() — únicas funções que tocam fetch
      hooks/
        useAnalysis.ts       # orquestra: upload → polling → resultado → reset
        useVideoRecorder.ts  # MediaRecorder API: gravar, parar, obter blob
      components/            # ExerciseSelector, VideoInput, AnalysisStatus, AnalysisResult, etc.
      pages/
        Home.tsx             # única página — orquestra todos os componentes
    index.html
    package.json
    vite.config.ts
    CLAUDE.md                # instruções específicas do front-end

  CLAUDE.md                  # este arquivo — visão geral do projeto
  README.md
```

---

## Exercícios suportados

| Valor na API | Rótulo UI   | Articulações analisadas    |
| ------------ | ----------- | -------------------------- |
| `squat`      | Agachamento | joelho, quadril, tornozelo |
| `situp`      | Abdominal   | quadril, coluna            |
| `pushup`     | Flexão      | cotovelo, ombro, quadril   |

---

## Contrato da API

### POST /analyze

**Request:** `multipart/form-data`

- `video` — arquivo de vídeo (mp4 ou webm)
- `exercise` — `"squat"` | `"situp"` | `"pushup"`

**Response imediata** (não espera o processamento):

```json
{ "job_id": "uuid-string", "status": "queued" }
```

### GET /status/{job_id}

Consultado via polling a cada 2s até `status === "done"`.

**Em processamento:**

```json
{ "status": "processing" }
```

**Concluído:**

```json
{
  "status": "done",
  "result": {
    "exercise": "squat",
    "result": "correct",
    "confidence": 0.87,
    "frames_analyzed": 42,
    "joint_angles": {
      "knee": [120, 118, 95, 88],
      "hip": [170, 165, 140, 130],
      "ankle": [90, 88, 85, 84]
    },
    "joint_results": {
      "knee": "incorrect",
      "hip": "correct",
      "ankle": "correct"
    },
    "errors": ["joelho passando a ponta do pé"]
  }
}
```

**Erro:**

```json
{ "status": "error", "result": "mensagem de erro" }
```

---

## Como rodar em desenvolvimento

```bash
# Terminal 1 — back-end
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — front-end
cd frontend
yarn install
yarn dev   # roda em localhost:5173
```

Em produção (ou para apresentação), fazer o build do front e servir pelo FastAPI:

```bash
cd frontend && yarn build
cd ../backend && uvicorn main:app --port 8000
# tudo disponível em http://localhost:8000
```

---

## Regras gerais para todo o projeto

- Todo código novo deve ser em **português** para comentários e nomes de variáveis de domínio (articulação, exercício, ângulo), e **inglês** para nomenclatura técnica (function, class, handler, router)
- Nunca commitar arquivos de vídeo ou o dataset no repositório
- Nunca commitar API keys (Roboflow ou qualquer outra)
- Variáveis de ambiente ficam em `.env` (back) e `.env.local` (front) — ambos no `.gitignore`
