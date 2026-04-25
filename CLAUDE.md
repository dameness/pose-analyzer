# Pose Analyzer

## Visão geral

Sistema de análise postural de exercícios físicos usando MediaPipe.
O usuário seleciona um exercício, envia um vídeo, e recebe feedback
visual indicando quais articulações estão corretas ou com erros posturais.

---

## Serviços

O monorepo tem três serviços independentes. Ver o `CLAUDE.md` de cada um para instruções detalhadas.

| Serviço | Tecnologia | Porta | CLAUDE.md |
|---------|------------|-------|-----------|
| backend | FastAPI (Python) | 8000 | `backend/CLAUDE.md` |
| frontend | React + Vite (TypeScript) | — (build estático servido pelo backend) | `frontend/CLAUDE.md` |
| exercise-execution-service | NestJS (TypeScript) | 3000 | `exercise-execution-service/CLAUDE.md` |

---

## Estrutura do repositório

```
pose-analyzer/
  backend/
    main.py                  # FastAPI — ponto de entrada, serve API + frontend buildado
    pipeline/
      __init__.py
      mediapipe_runner.py    # inicializa o Pose, processa frames, extrai keypoints
      angle_calculator.py    # calcular_angulo() — lógica de ângulos entre keypoints
      side_detector.py       # detecta lado da gravação (esquerdo/direito), rejeita frontal
      perspective_corrector.py  # corrige distorção de perspectiva ajustando X dos keypoints
      movement_detector.py   # detecta início/fim do movimento, descarta frames ociosos
      postural_checker.py    # lógica de correto/incorreto por exercício e articulação
      video_processor.py     # lê vídeo frame a frame via OpenCV, orquestra o pipeline
      video_annotator.py     # desenha esqueleto + articulações coloridas, grava H.264
    models/
      __init__.py
      schemas.py             # Pydantic models para request/response da API
    CLAUDE.md
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
    CLAUDE.md

  exercise-execution-service/  # NestJS — auth, exercícios, execuções (porta 3000)
    src/
      main.ts
      app.module.ts
      auth/                  # POST /auth/register, POST /auth/login
      users/                 # GET /me
      exercises/             # GET /exercises[/:id]
      executions/            # CRUD /executions[/:id]
      prisma/                # PrismaService com adapter libsql
      config/                # validação Joi de env vars
    prisma/
      schema.prisma          # User, Exercise, ExerciseExecution
      seed.ts                # upsert de exercícios e usuários de dev
      resolver-url-banco.ts  # utilitário: converte path relativo → absoluto para libsql
    test/                    # E2E (⚠️ suite completa pendente — ver CLAUDE.md do serviço)
    CLAUDE.md

  docs/
    superpowers/plans/
      2026-04-24-exercise-execution-service-nest.md  # plano de migração Express → NestJS

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

- `video` — arquivo de vídeo (mp4, webm ou mov)
- `exercise` — `"squat"` | `"situp"` | `"pushup"`

**Validação síncrona** (retorna antes de enfileirar):

- Exercício inválido → **422 Unprocessable Entity**
- Formato de arquivo não suportado → **415 Unsupported Media Type**

**Response de sucesso** — **202 Accepted** (não espera o processamento):

```json
{ "job_id": "uuid-string", "status": "queued" }
```

### GET /status/{job_id}

Consultado via polling a cada 2s até `status === "done"`.

Retorna **404** se o job não existe.

### GET /video/{job_id}

Disponível após `status === "done"`. Retorna o arquivo `.mp4` anotado (H.264)
para download ou exibição inline no browser.
Retorna 404 se o job não existe, ainda não terminou ou o arquivo temporário
foi removido (reinício do servidor).

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
    "trimmed_start": 18,
    "trimmed_end": 120,
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
    "errors": ["joelho passando a ponta do pé"],
    "video_url": "/video/uuid-string",
    "detected_side": "left",
    "perspective_correction": {
      "mean_theta_degrees": 12.3,
      "applied": true
    }
  }
}
```

**Erro no processamento** (job falhou após enfileirado):

```json
{
  "status": "error",
  "error_type": "validation_error" | "invalid_file" | "processing_error",
  "message": "descrição do erro"
}
```

| `error_type`       | Causa                                                      |
| ------------------ | ---------------------------------------------------------- |
| `validation_error` | Vídeo muito longo, exercício inválido, ou gravação frontal detectada |
| `invalid_file`     | Arquivo corrompido ou ilegível pelo OpenCV/PyAV            |
| `processing_error` | Erro inesperado no MediaPipe ou no pipeline de anotação    |

---

## Como rodar

Ver o `CLAUDE.md` de cada serviço para instruções de setup completas.

**Backend FastAPI + Frontend (análise de vídeo):**
```bash
cd frontend && yarn build
cd ../backend && uvicorn main:app --port 8000
# disponível em http://localhost:8000
```

**exercise-execution-service (auth + execuções):**
```bash
cd exercise-execution-service
npm install
npx prisma migrate dev
npx tsx prisma/seed.ts      # popula exercícios e usuários de dev
npm run start:dev
# disponível em http://localhost:3000
# Swagger em http://localhost:3000/api-docs
```

---

## Regras gerais para todo o projeto

- Todo código novo deve ser em **português** para comentários e nomes de variáveis de domínio (articulação, exercício, ângulo), e **inglês** para nomenclatura técnica (function, class, handler, router)
- Nunca commitar arquivos de vídeo ou o dataset no repositório
- Nunca commitar API keys (Roboflow ou qualquer outra)
- Variáveis de ambiente ficam em `.env` (back) e `.env.local` (front) — ambos no `.gitignore`
