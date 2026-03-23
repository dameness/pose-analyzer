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
      movement_detector.py   # detecta início/fim do movimento, descarta frames ociosos
      postural_checker.py    # lógica de correto/incorreto por exercício e articulação
      video_processor.py     # lê vídeo frame a frame via OpenCV, orquestra o pipeline
      video_annotator.py     # desenha esqueleto + articulações coloridas, grava H.264
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

- `video` — arquivo de vídeo (mp4, webm ou mov)
- `exercise` — `"squat"` | `"situp"` | `"pushup"`

**Response imediata** (não espera o processamento):

```json
{ "job_id": "uuid-string", "status": "queued" }
```

### GET /status/{job_id}

Consultado via polling a cada 2s até `status === "done"`.

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
    "video_url": "/video/uuid-string"
  }
}
```

**Erro:**

```json
{ "status": "error", "result": "mensagem de erro" }
```

---

## Como rodar

Ver `backend/CLAUDE.md` e `frontend/CLAUDE.md` para instruções de setup de cada camada.

Build de produção (front servido pelo FastAPI):

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
