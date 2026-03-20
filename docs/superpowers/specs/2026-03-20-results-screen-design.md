# Tela de Resultados — Design Spec

**Data:** 2026-03-20
**Projeto:** Pose Analyzer (TCC Bernardo Damiani)

---

## Contexto

O app já possui as etapas 1 (seleção de exercício) e 2 (envio de vídeo) implementadas em `Home.tsx`. O hook `useAnalysis` orquestra upload → polling → resultado e expõe `state.phase` (`idle | uploading | polling | done | error`) e `state.result: AnalysisResult | null`. Confirmado em `useAnalysis.ts`: `state.error: string | null` é preenchido com a mensagem de erro quando `phase === 'error'`. A etapa 3 ("Resultado") existe apenas no step indicator mas não tem conteúdo implementado.

---

## Pré-requisito

**`recharts`** deve ser instalado antes da implementação:
```bash
yarn add recharts
```
`recharts` (v2+) inclui seus próprios tipos TypeScript — não é necessário instalar `@types/recharts`.

---

## Componentes a criar

### `AnalysisStatus.tsx`

Tela de espera exibida nas fases `uploading` e `polling`.

- Props: `phase: AnalysisPhase`
- Spinner centralizado (animação CSS via Tailwind `animate-spin`)
- Texto dinâmico:
  - `uploading` → `"Enviando vídeo..."`
  - `polling` → `"Analisando sua postura..."`
- Subtexto fixo: `"Aguarde, isso pode levar alguns segundos"`
- Barra de progresso indeterminada (animação `animate-pulse`)

### `JointFeedback.tsx`

Indicador visual por articulação.

- Props: `joint: string`, `correct: boolean`
- Card compacto com fundo `bg-green-50 dark:bg-green-950/30` quando correto, `bg-red-50 dark:bg-red-950/30` quando incorreto
- Ícone `CheckCircle2` (verde) ou `XCircle` (vermelho) do `lucide-react`
- Nome da articulação exibido como recebido

### `AngleChart.tsx`

Gráfico de linhas dos ângulos ao longo dos frames.

- Props: `jointAngles: JointAngles`
- **Guard de vazio:** retorna `null` se o objeto não tiver nenhuma chave com pelo menos um valor numérico — ou seja, retorna `null` somente se `Object.values(jointAngles).every(arr => arr.length === 0)` ou `Object.keys(jointAngles).length === 0`. Se ao menos uma chave tiver dados, renderiza o gráfico com as chaves disponíveis.
- Usa `LineChart` do Recharts com `ResponsiveContainer`
- Uma `Line` por chave de `jointAngles`, cada uma com cor distinta (paleta de cores fixas por índice)
- Eixo X (`XAxis`): índice do frame, label `"Frame"`
- Eixo Y (`YAxis`): ângulo em graus, label `"Ângulo (°)"`
- `Tooltip` e `Legend` habilitados

### `AnalysisResult.tsx`

Tela de resultado em coluna única.

- Props: `result: AnalysisResult`, `exercise: ExerciseType`, `onReset: () => void`
- **Usar `result.exercise` para determinar o conjunto de articulações** — o prop `exercise` existe por consistência com `AnalysisResultProps` em `types/index.ts`, mas deve sempre ser igual a `result.exercise`.
- Este componente é renderizado pelo pai **somente quando `phase === 'done'`**, portanto todos os seus elementos (inclusive o botão "Analisar novamente") são sempre visíveis quando o componente está montado. Não é necessário receber ou verificar `phase` internamente.

Seções em ordem:

**1. Cabeçalho de veredicto**
- Badge grande: `"Execução Correta"` com `bg-green-100 text-green-800` e ícone `CheckCircle2`, ou `"Execução Incorreta"` com `bg-red-100 text-red-800` e ícone `XCircle`
- Linha de metadados: `"X% de confiança · Y frames analisados"`
  - Confiança: `Math.round(result.confidence * 100)` → exibir como `"87%"` (não `"0.87%"`)

**2. Grid de articulações**
- Grade responsiva (`grid-cols-2 sm:grid-cols-3`) de `JointFeedback`
- Articulações por exercício (derivadas de `result.exercise`):
  - `squat`: `["joelho", "quadril", "tornozelo"]`
  - `situp`: `["quadril", "coluna"]`
  - `pushup`: `["cotovelo", "ombro", "quadril"]`
- **Regra de correção por articulação:** `correct: false` se algum item de `result.errors` contiver o nome da articulação como substring (case-insensitive, via `.toLowerCase().includes(joint.toLowerCase())`). Caso contrário, `correct: true`.
  - Se `result.errors` for vazio, todas as articulações são `correct: true`, mesmo que `result.result === 'incorrect'` — `errors` é a fonte de verdade para o mapeamento por articulação.

**3. Lista de erros**
- Só renderiza se `result.errors.length > 0`
- Card de aviso com ícone `AlertTriangle` (âmbar) e bullet list dos erros

**4. Gráfico de ângulos**
- Renderiza `<AngleChart jointAngles={result.joint_angles} />`
- Se `AngleChart` retornar `null` (objeto vazio ou sem dados), esta seção não aparece

**5. Botão "Analisar novamente"**
- Chama `onReset`

---

## Mudanças em `Home.tsx`

### `handleReset`

Nova função:
```ts
function handleReset() {
  analysis.reset(); // devolve phase para 'idle', NÃO altera step
}
```
Diferente de `handleBack`, que também chama `setStep('select')`.

### Estrutura de renderização do conteúdo principal

Os novos blocos são adicionados como **irmãos** após o bloco do step 2 existente, dentro do `<main>`:

```tsx
{/* Bloco step 2 existente — NÃO modificar */}
{selectedExercise !== null && (
  <div className={step === 'video' ? 'flex flex-col gap-6' : 'hidden'}>
    {/* VideoInput e botão Voltar permanecem aqui */}
    {/* Voltar continua disabled quando analysis.state.phase !== 'idle' */}
  </div>
)}

{/* Novos blocos — etapa 3 */}
{(analysis.state.phase === 'uploading' || analysis.state.phase === 'polling') && (
  <AnalysisStatus phase={analysis.state.phase} />
)}

{analysis.state.phase === 'done' && analysis.state.result !== null && (
  <AnalysisResult
    result={analysis.state.result}
    exercise={selectedExercise!}
    onReset={handleReset}
  />
)}

{analysis.state.phase === 'error' && (
  // card de erro — ver seção abaixo
)}
```

Durante `uploading`/`polling`/`done`/`error`, o `VideoInput` está desabilitado (`disabled={analysis.state.phase !== 'idle'}`). O bloco do step 2 permanece montado mas inerte. Os novos blocos aparecem abaixo.

### Card de erro

Quando `analysis.state.phase === 'error'`:
- Card com ícone `XCircle` (vermelho), título `"Erro na análise"` e mensagem `analysis.state.error`
- Botão `"Tentar novamente"` que chama `analysis.reset()` — ao fazer isso, `phase` volta para `'idle'`, o `VideoInput` é reabilitado e o botão "Voltar" do step 2 também volta a funcionar. Como `useVideoRecorder` não é alterado, o estado interno do `VideoInput` persiste: a prévia do vídeo gravado/selecionado anteriormente continua visível, e o usuário pode reenviar o mesmo vídeo ou gravar/selecionar um novo. O usuário também pode clicar em "Voltar" para retornar ao step 1.

### Step indicator — estados visuais

O indicador usa três estilos: **indigo** (ativo), **verde com check** (concluído), **cinza com borda** (futuro).

#### Etapa 1 — sem alteração (já implementado)

#### Etapa 2 — refatorar o ternário existente de dois estados para três estados

O botão da etapa 2 no step indicator serve tanto para estilo visual quanto para navegação (clique avança para o step 2 quando exercício está selecionado e `phase === 'idle'`). A lógica de `onClick`/`disabled` existente não muda — apenas o estilo visual do círculo e label são expandidos.

```tsx
// Estilo do círculo — antes (atual):
step === 'video' ? 'bg-indigo-600 text-white' : 'border-2 border-gray-300 ...'

// Depois:
analysis.state.phase !== 'idle'
  ? 'bg-green-500 text-white'           // verde check (concluída)
  : step === 'video'
    ? 'bg-indigo-600 text-white'         // indigo (ativa)
    : 'border-2 border-gray-300 ...'     // cinza (futura)
```

Conteúdo do círculo: `<Check className="w-3 h-3" />` quando `analysis.state.phase !== 'idle'`, senão `"2"`.

Label da etapa 2 — refatorar da mesma forma:
- `analysis.state.phase !== 'idle'` → `text-gray-400 dark:text-gray-500` (concluída, esmaecida)
- `step === 'video'` → `font-medium text-gray-700 dark:text-gray-300` (ativa)
- caso contrário → `text-gray-400 dark:text-gray-500` (futura)

#### Etapa 3 — novo (substituir o `<span>` estático atual por lógica condicional)

Círculo:
- `analysis.state.phase === 'done'` → `bg-green-500 text-white` com `<Check className="w-3 h-3" />`
- `analysis.state.phase === 'uploading' || analysis.state.phase === 'polling'` → `bg-indigo-600 text-white` com `"3"`
- caso contrário → `border-2 border-gray-300 dark:border-gray-600 text-gray-400` com `"3"`

Label `"Resultado"`:
- `analysis.state.phase === 'done'` → `text-gray-400 dark:text-gray-500` (concluída, esmaecida)
- `analysis.state.phase === 'uploading' || analysis.state.phase === 'polling'` → `font-medium text-gray-700 dark:text-gray-300` (ativa)
- caso contrário → `text-gray-400 dark:text-gray-500` (futura)

---

## O que não muda

`ExerciseSelector`, `VideoInput`, `useAnalysis`, `useVideoRecorder`, `api.ts`, `types/index.ts` — nenhuma alteração.

---

## Restrições do projeto

- Sem componentes de UI externos além de `lucide-react` e `recharts`
- Sem `style={{}}` inline — apenas classes Tailwind
- Sem `any` no TypeScript — usar interfaces de `types/index.ts`
- Interface responsiva para mobile
