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

Sem gerenciamento de estado global. Sem bibliotecas de UI (MUI, Chakra, etc).

---

## Estrutura de pastas

```
src/
  types/
    index.ts              # todas as interfaces TypeScript — fonte da verdade dos tipos

  services/
    api.ts                # submitVideo() e getStatus() — únicas funções que tocam fetch

  hooks/
    useAnalysis.ts        # orquestra: upload → polling → resultado → reset
    useVideoRecorder.ts   # MediaRecorder API: gravar, parar, obter blob

  components/
    ExerciseSelector.tsx  # três cards clicáveis: Agachamento, Abdominal, Flexão
    VideoInput.tsx        # gravar pela câmera OU fazer upload de arquivo
    AnalysisStatus.tsx    # spinner + mensagem durante o polling
    AnalysisResult.tsx    # resultado completo — orquestra JointFeedback + AngleChart
    JointFeedback.tsx     # uma articulação: nome + ícone verde/vermelho
    AngleChart.tsx        # Recharts LineChart dos ângulos ao longo dos frames

  pages/
    Home.tsx              # única página — orquestra todos os componentes

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
- Gravar: acessa câmera via `getUserMedia`, botão iniciar/parar, preview do vídeo gravado
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
- Nome da articulação vem diretamente das keys de `joint_results` (já em português, definido pelo back-end)

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
- Botão "Analisar novamente" que reseta o estado

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

## O que NÃO fazer

- Não usar `any` — tipar tudo com as interfaces de `types/index.ts`
- Não fazer chamadas fetch fora de `services/api.ts`
- Não colocar lógica de polling dentro de componentes — pertence ao `useAnalysis`
- Não esquecer o cleanup do `setInterval` no return do `useEffect`
- Não estilizar com `style={{}}` inline — usar classes Tailwind
- Não mapear nomes de articulações do inglês para português dentro do back-end —
  essa tradução é responsabilidade do front-end
