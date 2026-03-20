# Pose Analyzer — TCC Bernardo Damiani

## Visão geral do projeto

Interface web para análise postural de exercícios físicos usando IA.
O usuário seleciona um exercício, grava ou faz upload de um vídeo, e recebe
feedback visual sobre a execução — indicando quais articulações estão corretas
e quais apresentam erros posturais.

Projeto acadêmico: TCC de Bacharelado em Ciência da Computação —
Instituto Federal Sul-rio-grandense, Câmpus Passo Fundo.

---

## Stack

- React 19 + TypeScript
- Vite (bundler)
- Tailwind CSS (estilização — sem componentes de UI externos)
- Fetch nativo (sem axios)
- Sem gerenciamento de estado global (useState + Context são suficientes)
- Sem bibliotecas de UI pesadas (sem MUI, sem Ant Design, sem Chakra)

---

## Back-end

FastAPI rodando no Google Colab, exposto publicamente via ngrok.
A URL base vem sempre da variável de ambiente:

```
VITE_API_URL=https://<hash>.ngrok-free.app
```

Essa URL muda a cada vez que o Colab é reiniciado.
Nunca hardcodar a URL no código — sempre usar `import.meta.env.VITE_API_URL`.

---

## Exercícios suportados

| Valor enviado à API | Rótulo exibido ao usuário |
| ------------------- | ------------------------- |
| `squat`             | Agachamento               |
| `situp`             | Abdominal                 |
| `pushup`            | Flexão                    |

---

## Contrato da API

### POST /analyze

Envia o vídeo para processamento. Retorna imediatamente sem esperar a análise.

**Request:** `multipart/form-data`

- `video` — arquivo de vídeo (mp4 ou webm)
- `exercise` — `"squat"` | `"situp"` | `"pushup"`

**Response:**

```json
{
  "job_id": "uuid-string",
  "status": "queued"
}
```

---

### GET /status/:job_id

Consultado via polling a cada 2 segundos até `status === "done"`.

**Response — em processamento:**

```json
{ "status": "processing" }
```

**Response — concluído:**

```json
{
  "status": "done",
  "result": {
    "exercise": "squat",
    "result": "correct" | "incorrect",
    "confidence": 0.87,
    "frames_analyzed": 42,
    "joint_angles": {
      "knee":  [120, 118, 95, 88],
      "hip":   [170, 165, 140, 130],
      "ankle": [90, 88, 85, 84]
    },
    "errors": ["joelho passando a ponta do pé"]
  }
}
```

**Response — erro:**

```json
{ "status": "error", "result": "mensagem de erro" }
```

---

## Estrutura de pastas

```
src/
  types/
    index.ts          # todas as interfaces TypeScript do projeto

  services/
    api.ts            # funções de chamada à API (submitVideo, getStatus)

  hooks/
    useAnalysis.ts    # orquestra upload → polling → resultado
    useVideoRecorder.ts  # MediaRecorder API do navegador

  components/
    ExerciseSelector.tsx   # cards para escolher squat / situp / pushup
    VideoInput.tsx         # gravar via câmera OU fazer upload de arquivo
    AnalysisStatus.tsx     # feedback de loading durante o polling
    AnalysisResult.tsx     # exibe resultado final com feedback por articulação
    JointFeedback.tsx      # indicador visual por articulação (correto/incorreto)
    AngleChart.tsx         # gráfico de linha mostrando ângulos ao longo dos frames

  pages/
    Home.tsx          # página única — orquestra todos os componentes

  main.tsx
  App.tsx
```

---

## Fluxo da aplicação

```
1. Usuário escolhe o exercício (ExerciseSelector)
2. Usuário grava pela câmera ou faz upload de um vídeo (VideoInput)
3. Front-end envia POST /analyze com o vídeo e o exercício
4. Recebe job_id — inicia polling em GET /status/:job_id a cada 2s
5. Exibe estado de carregamento (AnalysisStatus)
6. Quando status === "done", exibe resultado (AnalysisResult)
7. Usuário pode reiniciar e analisar outro vídeo
```

---

## Decisões técnicas

**Polling e não WebSocket** — o back-end roda no Colab via ngrok e não suporta
conexões persistentes de forma confiável. Polling a cada 2s é mais robusto nesse contexto.

**Cleanup do polling** — o interval do polling deve ser sempre limpo no cleanup
do useEffect para evitar memory leaks quando o componente desmontar.

**Gravação de vídeo** — usar a MediaRecorder API nativa do navegador.
Gravar em `video/webm` (melhor suporte cross-browser).
Limitar a gravação a 30 segundos para evitar arquivos muito grandes.

**Mock data em desenvolvimento** — quando `VITE_API_URL` não estiver definida,
os hooks devem retornar dados mockados após 3 segundos para permitir
desenvolvimento da UI sem o back-end rodando.

**Feedback por articulação** — o componente JointFeedback recebe o nome da
articulação e um booleano `correct`, exibindo verde ou vermelho com ícone.
As articulações variam por exercício:

- squat: joelho, quadril, tornozelo
- situp: quadril, coluna
- pushup: cotovelo, ombro, quadril

**Gráfico de ângulos** — usar Recharts para o gráfico de linha dos `joint_angles`
ao longo dos frames. É a única biblioteca de terceiros permitida além do Tailwind.

**Responsividade** — a interface deve funcionar em mobile, pois o usuário pode
estar se exercitando e usando o celular para gravar.

---

## O que NÃO fazer

- Não hardcodar a URL da API
- Não usar `any` no TypeScript — tipar tudo com as interfaces de `types/index.ts`
- Não estilizar com `style={{}}` inline — usar classes Tailwind
- Não criar lógica de negócio dentro de componentes — isolar em hooks e services
- Não esquecer o cleanup do useEffect nos hooks com interval ou timeout
- Não instalar Redux, Zustand ou qualquer gerenciador de estado global

---

## Variáveis de ambiente

```bash
# .env.local
VITE_API_URL=https://<hash>.ngrok-free.app
```

---

## Como iniciar o desenvolvimento

```bash
npm install
npm run dev
```
