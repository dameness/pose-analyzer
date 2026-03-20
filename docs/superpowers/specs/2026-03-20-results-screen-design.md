# Tela de Resultados — Design Spec

**Data:** 2026-03-20
**Projeto:** Pose Analyzer (TCC Bernardo Damiani)

---

## Contexto

O app já possui as etapas 1 (seleção de exercício) e 2 (envio de vídeo) implementadas em `Home.tsx`. O hook `useAnalysis` orquestra upload → polling → resultado e expõe `state.phase` (`idle | uploading | polling | done | error`) e `state.result: AnalysisResult | null`. A etapa 3 ("Resultado") existe apenas no step indicator mas não tem conteúdo implementado.

---

## Componentes a criar

### `AnalysisStatus.tsx`

Tela de espera exibida nas fases `uploading` e `polling`.

- Props: `phase: AnalysisPhase`
- Spinner centralizado (animação CSS via Tailwind)
- Texto dinâmico: `"Enviando vídeo..."` em `uploading`, `"Analisando sua postura..."` em `polling`
- Subtexto: `"Aguarde, isso pode levar alguns segundos"`
- Barra de progresso indeterminada (animação de pulso)

### `JointFeedback.tsx`

Indicador visual por articulação.

- Props: `joint: string`, `correct: boolean`
- Card compacto com fundo verde (`bg-green-50`) ou vermelho (`bg-red-50`)
- Ícone `CheckCircle2` (verde) ou `XCircle` (vermelho) do `lucide-react`
- Nome da articulação capitalizado

### `AnalysisResult.tsx`

Tela de resultado em coluna única. Props: `result: AnalysisResult`, `exercise: ExerciseType`, `onReset: () => void`.

Seções em ordem:

1. **Cabeçalho de veredicto** — badge grande `"Execução Correta"` (verde) ou `"Execução Incorreta"` (vermelho), confiança em % e frames analisados
2. **Grid de articulações** — grade responsiva de `JointFeedback`, articulações por exercício:
   - `squat`: joelho, quadril, tornozelo
   - `situp`: quadril, coluna
   - `pushup`: cotovelo, ombro, quadril
   A correção de cada articulação é determinada por: articulação está em `errors` → `incorrect`, caso contrário → `correct`
3. **Lista de erros** — só renderiza se `errors.length > 0`; card de aviso com ícone `AlertTriangle` e bullet list dos erros
4. **Gráfico de ângulos** — componente `AngleChart`
5. **Botão "Analisar novamente"** — chama `onReset`, estilo primário indigo

### `AngleChart.tsx`

Gráfico de linhas dos ângulos ao longo dos frames.

- Props: `jointAngles: JointAngles`
- Usa `LineChart` do Recharts (`recharts` instalado via yarn)
- Uma `Line` por chave de `jointAngles`, cada uma com cor distinta
- Eixo X: índice do frame ("Frame")
- Eixo Y: ângulo em graus ("Ângulo (°)")
- `Tooltip` e `Legend` habilitados
- `ResponsiveContainer` para responsividade

---

## Mudanças em `Home.tsx`

### Step indicator

Quando `analysis.state.phase !== 'idle'`, a etapa 3 é marcada como ativa (número `3` com fundo indigo). Isso sinaliza visualmente que a análise avançou além da etapa 2.

### Lógica de renderização (step 2 / step 3)

Adicionar bloco condicional após o bloco do step 2:

- `phase === 'uploading' || phase === 'polling'` → renderiza `<AnalysisStatus phase={...} />`
- `phase === 'done' && result !== null` → renderiza `<AnalysisResult result={...} exercise={...} onReset={...} />`
- `phase === 'error'` → renderiza card de erro com mensagem e botão "Tentar novamente" que chama `analysis.reset()` e volta ao step 2

A `handleBack` já chama `analysis.reset()` e volta ao step `select`. O botão "Analisar novamente" em `AnalysisResult` deve chamar `analysis.reset()` sem mudar o `step` — o usuário volta à etapa 2 com o mesmo exercício selecionado.

---

## Dependências

- **`recharts`** — instalar via `yarn add recharts`
- **`lucide-react`** — já instalado

---

## O que não muda

`ExerciseSelector`, `VideoInput`, `useAnalysis`, `useVideoRecorder`, `api.ts`, `types/index.ts` — nenhuma alteração.

---

## Restrições do projeto

- Sem componentes de UI externos além de `lucide-react` e `recharts`
- Sem `style={{}}` inline — apenas classes Tailwind
- Sem `any` no TypeScript — usar interfaces de `types/index.ts`
- Interface responsiva para mobile
