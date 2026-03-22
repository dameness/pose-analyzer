# Frontend — Pose Analyzer

Leia também o `CLAUDE.md` na raiz do projeto para contexto geral.

---

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Yarn
- Recharts (gráfico de ângulos por frame)
- lucide-react (ícones)
- Fetch nativo — sem axios
- Vitest + React Testing Library (testes unitários de hooks)

Sem gerenciamento de estado global. Sem bibliotecas de UI (MUI, Chakra, etc).

---

## Estrutura de pastas

```
src/
  types/
    index.ts              # todas as interfaces TypeScript — fonte da verdade dos tipos

  services/
    api.ts                # submitVideo(), getStatus(), buildVideoUrl() — únicas funções que tocam fetch

  hooks/
    useAnalysis.ts        # orquestra: upload → polling → resultado → reset
    useVideoRecorder.ts   # MediaRecorder API: gravar, pausar, retomar, parar, obter blob

  components/
    ExerciseSelector.tsx  # três cards clicáveis: Agachamento, Abdominal, Flexão
    VideoInput.tsx        # gravar pela câmera OU fazer upload; recebe `recorder` como prop
    AnalysisStatus.tsx    # spinner + mensagem durante o polling
    AnalysisResult.tsx    # resultado completo — orquestra JointFeedback + AngleChart
    JointFeedback.tsx     # uma articulação: nome + ícone verde/vermelho
    AngleChart.tsx        # Recharts LineChart dos ângulos ao longo dos frames

  pages/
    Home.tsx              # única página — orquestra todos os componentes

  test/
    setup.ts              # mocks globais: MockMediaRecorder, getUserMedia
    useVideoRecorder.test.ts  # testes do hook de gravação

  main.tsx
  App.tsx
```

---

## Interfaces TypeScript (`types/index.ts`)

```typescript
export type ExerciseType = 'squat' | 'situp' | 'pushup';

export interface AnalysisResult {
  exercise: ExerciseType;
  result: 'correct' | 'incorrect';
  confidence: number;
  frames_analyzed: number;
  joint_angles: Record<string, number[]>; // ex: { knee: [120, 118, 95] }
  joint_results: Record<string, 'correct' | 'incorrect'>; // ex: { knee: 'incorrect' }
  errors: string[];
  video_url?: string; // caminho relativo ao backend, ex: "/video/{job_id}"
}

export type StatusResponse =
  | { status: 'processing' }
  | { status: 'done'; result: AnalysisResult }
  | { status: 'error'; result: string };
```

---

## Variáveis de ambiente

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:8000
```

Em produção (front servido pelo FastAPI), `VITE_API_URL` não é necessária —
usar caminho relativo `/` é suficiente.

---

## Mock data para desenvolvimento sem back-end

Quando `import.meta.env.VITE_API_URL` não estiver definida, `services/api.ts`
simula uma resposta após 3 segundos.

Mock de resultado definido em `services/api.ts`:

```typescript
const mockResult: StatusResponse = {
  status: 'done',
  result: {
    exercise: 'squat',
    result: 'incorrect',
    confidence: 0.87,
    frames_analyzed: 42,
    joint_angles: {
      knee: [120, 118, 95, 88],
      hip: [170, 165, 140, 130],
      ankle: [90, 88, 85, 84],
    },
    joint_results: {
      knee: 'incorrect',
      hip: 'correct',
      ankle: 'correct',
    },
    errors: ['joelho passando a ponta do pé'],
  },
};
```

---

## Comportamento dos componentes

### ExerciseSelector

- Três cards lado a lado (ou empilhados no mobile)
- Card selecionado tem borda destacada e fundo diferenciado
- Cada card mostra: ícone representativo, nome do exercício, articulações analisadas

### VideoInput

- Duas abas: "Gravar" e "Upload"
- Recebe `recorder` como prop (instância de `useVideoRecorder` criada em `Home.tsx`)
- Gravar: acessa câmera via `getUserMedia`, botões iniciar / pausar / retomar / parar, preview ao vivo
- Durante gravação: botão amarelo de pausa (Pause/Play) + botão vermelho de parar; badge "Pausado" visível quando pausado
- Upload: input file aceitando `video/mp4,video/webm`
- Limite visual de 30 segundos na gravação (contador regressivo)
- Após ter o vídeo (gravado ou uploaded), mostrar preview e botão "Analisar"

### AnalysisStatus

- Spinner animado
- Mensagens por fase: "Enviando vídeo..." (uploading), "Analisando sua postura..." (polling)
- Não mostrar percentual — o back-end não retorna progresso

### JointFeedback

- Ícone de check verde (`lucide-react: CheckCircle2`) para correto
- Ícone de X vermelho (`lucide-react: XCircle`) para incorreto
- Keys de `joint_results` chegam em inglês da API — a tradução para português (knee → joelho, hip → quadril, etc.) é feita via `NOME_ARTICULACAO` em `AnalysisResult.tsx`

### AngleChart

- Recharts `LineChart` com `ResponsiveContainer width="100%"`
- Uma linha por articulação, cores distintas
- Eixo X: número do frame
- Eixo Y: ângulo em graus
- Tooltip mostrando valor exato ao hover
- Legenda com os nomes das articulações

### AnalysisResult

- Header: exercício realizado + resultado geral (verde/vermelho)
- Lista de JointFeedback para cada articulação
- Lista de erros encontrados (se `errors.length > 0`)
- AngleChart abaixo
- Player de vídeo anotado inline (se `result.video_url` presente) + botão de download
- Botão "Analisar novamente" que reseta o estado

O campo `video_url` chega como caminho relativo ao backend (ex: `"/video/{job_id}"`).
**Nunca** usar diretamente como `src` do `<video>` em desenvolvimento — o browser
resolveria contra o Vite (`localhost:5173`), não o backend (`localhost:8000`).
Sempre passar por `buildVideoUrl(video_url)` de `services/api.ts`, que prepende
`VITE_API_URL`. Em produção (front servido pelo FastAPI), `VITE_API_URL` é `""`
e o caminho relativo funciona normalmente.

---

## useVideoRecorder

`Home.tsx` instancia o hook e passa o objeto `recorder` para `VideoInput` como prop. Isso permite que `Home.tsx` chame `recorder.stopRecording()` ao navegar de volta para a seleção de exercício.

```typescript
export type UseVideoRecorderReturn = {
  state: VideoRecorderState; // status: 'idle' | 'recording' | 'paused' | 'stopped'
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;   // chama MediaRecorder.pause()
  resumeRecording: () => void;  // chama MediaRecorder.resume()
  reset: () => void;
  streamRef: React.RefObject<MediaStream | null>;
};
```

Fluxo de status da gravação:

```
idle
  → (startRecording) → recording
  → (pauseRecording) → paused
  → (resumeRecording) → recording
  → (stopRecording)  → stopped   ← blob disponível em state.videoBlob
  → (reset)          → idle
```

Ao navegar de volta (`handleBack` em `Home.tsx`), se o status for `'recording'` ou `'paused'`, `stopRecording()` é chamado automaticamente — o vídeo parcial fica disponível em `state.videoBlob` quando o usuário retornar ao step 2.

---

## Fluxo de estado no useAnalysis

```
idle
  → (submitVideo chamado) → uploading
  → (POST /analyze retornou job_id) → polling
  → (GET /status retornou "done") → done
  → (erro em qualquer etapa) → error
  → (reset chamado) → idle
```

O hook expõe:

```typescript
{
  state: {
    phase: 'idle' | 'uploading' | 'polling' | 'done' | 'error';
    result: AnalysisResult | null;
    error: string | null;
  };
  submit: (file: File, exercise: ExerciseType) => Promise<void>;
  reset: () => void;
}
```

---

## Responsividade

- Layout: coluna única, max-width 768px (centralizado)
- ExerciseSelector: grid de 1 coluna no mobile, 3 colunas no desktop

---

## Testes

Framework: **Vitest** + **React Testing Library** (jsdom).

```bash
yarn test         # roda uma vez
yarn test:watch   # modo watch
```

Configuração em `vitest.config.ts` (separado do `vite.config.ts` — não usa o plugin Babel do React Compiler, que conflita com Vitest).

O diretório `src/test/` é excluído do `tsconfig.app.json` para não poluir o build de produção.

**`src/test/setup.ts`** — mocks globais registrados via `globalThis`:
- `MockMediaRecorder`: implementa a interface do `MediaRecorder` (start/stop/pause/resume), rastreia última instância em `_lastInstance`
- `navigator.mediaDevices.getUserMedia`: retorna uma stream fake com uma faixa de vídeo

Ao adicionar novos testes de hooks que dependem de APIs de browser, adicionar os mocks necessários no `setup.ts`.

---

## O que NÃO fazer

- Não usar `any` — tipar tudo com as interfaces de `types/index.ts`
- Não fazer chamadas fetch fora de `services/api.ts`
- Não colocar lógica de polling dentro de componentes — pertence ao `useAnalysis`
- Não esquecer o cleanup do `setInterval` no return do `useEffect`
- Não instanciar `useVideoRecorder` dentro de `VideoInput` — o hook pertence a `Home.tsx`
- Não usar `global` nos arquivos de teste — usar `globalThis` (compatível com browser e Node)
- Não estilizar com `style={{}}` inline — usar classes Tailwind
- Não mapear nomes de articulações do inglês para português dentro do back-end —
  essa tradução é responsabilidade do front-end
- Não usar `result.video_url` diretamente como `src` de `<video>` — sempre passar
  por `buildVideoUrl()` (corrige o problema de porta em desenvolvimento)
