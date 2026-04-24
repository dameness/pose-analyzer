# Exercise Execution Service

API REST para registro de execuções de exercícios físicos, desenvolvida como Trabalho I da disciplina **Serviços Web (PF_CC.44)** — IFSul Câmpus Passo Fundo. Professor Élder F. F. Bernardi.

---

## Contexto

Este backend complementa um TCC de análise postural com MediaPipe. A API **não realiza análise postural** — ela armazena o histórico de execuções de exercício do usuário, incluindo o resultado agregado da análise (correct/incorrect + score de confiança).

---

## Stack

| Tecnologia | Papel |
|---|---|
| Node.js (LTS) + TypeScript | Runtime e linguagem |
| Express.js | Framework HTTP |
| SQLite | Banco de dados (arquivo local) |
| Prisma | ORM |
| JWT (jsonwebtoken) | Autenticação stateless |
| Zod | Validação de schemas |
| Swagger UI | Documentação interativa em `/api-docs` |
| bcrypt | Hash de senhas |

---

## Instalação e execução

```bash
# 1. Instalar dependências
npm install

# 2. Criar o banco e rodar as migrations
npx prisma migrate dev

# 3. Popular o banco com dados iniciais
npm run seed

# 4. Subir o servidor em modo desenvolvimento
npm run dev
```

O servidor sobe em `http://localhost:3000` (ou na `PORT` definida no `.env`).

Swagger UI disponível em: `http://localhost:3000/api-docs`

### Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste conforme necessário:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="troque-isto-em-producao"
JWT_EXPIRES_IN="24h"
BCRYPT_ROUNDS=10
PORT=3000
NODE_ENV=development
```

---

## Modelo de domínio

### User

| Campo | Tipo | Observações |
|---|---|---|
| id | Int | PK, autoincrement |
| email | String | único |
| password | String | hash bcrypt |
| name | String | |
| createdAt | DateTime | default now() |

### Exercise

Catálogo de exercícios suportados. **Somente leitura via API**, populado via seed com squat, pushup e situp.

| Campo | Tipo | Observações |
|---|---|---|
| id | Int | PK, autoincrement |
| slug | String | único — ex: `"squat"` |
| name | String | ex: `"Agachamento"` |
| description | String | descrição da execução correta |
| createdAt | DateTime | default now() |

### ExerciseExecution

Uma execução de uma série de repetições de um exercício pelo usuário, com resultado agregado da análise postural.

| Campo | Tipo | Observações |
|---|---|---|
| id | Int | PK, autoincrement |
| userId | Int | FK → User.id |
| exerciseId | Int | FK → Exercise.id |
| reps | Int | número de repetições |
| durationSec | Int | duração total em segundos |
| result | String | `"correct"` \| `"incorrect"` |
| score | Float | 0.0 a 1.0, confiança da análise |
| executedAt | DateTime | quando o exercício foi executado |
| createdAt | DateTime | default now() |

---

## Tabela de rotas

### Públicas

| Método | Rota | Descrição | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/auth/register` | Cria conta de usuário | 201 | 400, 409 |
| POST | `/auth/login` | Autentica e retorna JWT | 200 | 400, 401 |
| GET | `/exercises` | Lista exercícios do catálogo | 200 | — |
| GET | `/exercises/:id` | Detalha um exercício | 200 | 404 |
| GET | `/api-docs` | Swagger UI | 200 | — |
| GET | `/health` | Health check | 200 | — |

### Protegidas — requerem `Authorization: Bearer <token>`

| Método | Rota | Descrição | Sucesso | Erros |
|---|---|---|---|---|
| GET | `/me` | Dados do usuário autenticado | 200 | 401 |
| GET | `/executions` | Lista execuções do próprio usuário | 200 | 401 |
| GET | `/executions/:id` | Detalha execução do próprio usuário | 200 | 401, 404 |
| POST | `/executions` | Registra nova execução | 201 | 400, 401, 404 |
| PUT | `/executions/:id` | Atualiza execução do próprio usuário | 200 | 400, 401, 404 |
| DELETE | `/executions/:id` | Remove execução do próprio usuário | 204 | 401, 404 |

### Status codes

| Código | Significado |
|---|---|
| 200 | Leitura ou atualização OK |
| 201 | Criação OK (inclui header `Location`) |
| 204 | Exclusão OK (sem corpo) |
| 400 | Payload inválido (validação Zod falhou) |
| 401 | Token ausente ou inválido |
| 404 | Recurso não existe ou pertence a outro usuário |
| 409 | Conflito — email duplicado no registro |
| 500 | Erro inesperado |

> **Segurança:** ao acessar uma execução que pertence a outro usuário, a API retorna 404 (e não 403), evitando vazar a existência de IDs alheios.

---

## Arquitetura

O projeto segue arquitetura em camadas, sem pular níveis:

```
Router → Controller → Service → Repository (Prisma)
```

- **Router** — define as rotas e aplica middlewares (autenticação, validação).
- **Controller** — extrai dados da requisição, chama o service, serializa a resposta.
- **Service** — contém a lógica de negócio (regras de ownership, hash, JWT).
- **Repository** — única camada que fala com o Prisma/banco.

```
src/
├── config/env.ts          # valida variáveis de ambiente com Zod
├── lib/prisma.ts          # singleton do PrismaClient
├── middlewares/
│   ├── authenticate.ts    # valida JWT, popula req.user
│   ├── validate.ts        # valida body/params/query com Zod
│   └── errorHandler.ts    # handler central de erros
├── errors/AppError.ts     # AppError, NotFoundError, ConflictError, etc.
└── modules/
    ├── auth/              # register, login
    ├── users/             # /me
    ├── exercises/         # catálogo read-only
    └── executions/        # CRUD com ownership
```

---

## Autenticação

- Login retorna `{ token, user }`.
- Token JWT assinado com `JWT_SECRET`, expiração de 24h.
- Payload do token: `{ sub: userId }`.
- Middleware `authenticate` lê o header `Authorization: Bearer <token>`, valida e popula `req.user`.
- A API é **stateless** — nenhum estado de sessão é mantido no servidor.

---

## Testes via Postman

Importe o arquivo [`postman/api-exercicios.postman_collection.json`](./postman/api-exercicios.postman_collection.json) no Postman.

A collection está organizada nas pastas: **Auth**, **Exercises**, **Executions**, **Me**.

Configure a variável de ambiente `{{baseUrl}}` como `http://localhost:3000`. A requisição **Login** salva o token automaticamente na variável `{{token}}` via script de teste — basta executar o login uma vez e todas as rotas protegidas já estarão autenticadas.

**Dados do seed para teste:**

| Usuário | Senha |
|---|---|
| alice@example.com | senha123 |
| bob@example.com | senha123 |

---

## Pesquisa e embasamento técnico

### Express vs Fastify vs NestJS

**Express** foi escolhido por ser o framework mais maduro e amplamente adotado no ecossistema Node.js, com vasta documentação e familiaridade. **Fastify** oferece melhor throughput e validação de schema nativa, sendo uma alternativa sólida para cenários de alta performance. **NestJS** provê estrutura opinada com decorators e injeção de dependência, o que reduz decisões arquiteturais mas aumenta a curva de aprendizado e o boilerplate — faz mais sentido em projetos de grande escala com equipes maiores. Para este projeto acadêmico com escopo definido, Express equilibra simplicidade e controle.

### Prisma vs TypeORM vs Drizzle

**Prisma** foi escolhido pela DX superior: schema declarativo, cliente tipado gerado automaticamente e CLI de migrations. **TypeORM** é mais maduro e usa decorators diretamente nas entidades (padrão Active Record ou Data Mapper), mas o suporte a TypeScript é menos preciso. **Drizzle** é a alternativa mais moderna, com queries em TypeScript puro e zero overhead de runtime, mas ainda com ecossistema em crescimento. Prisma entrega a melhor combinação de produtividade e segurança de tipos para projetos novos.

### JWT vs Sessions

**JWT** (escolhido) é stateless: o servidor não armazena estado de sessão, o que facilita escalabilidade horizontal. O token carrega o payload assinado e é validado localmente. A desvantagem é que não há revogação imediata — um token comprometido é válido até expirar. **Sessions** são stateful: o servidor mantém o estado (geralmente em Redis ou banco), o que permite revogação instantânea mas adiciona dependência de infraestrutura. Para uma API REST sem requisito de revogação imediata, JWT é a escolha natural.

### SQLite vs PostgreSQL

**SQLite** é usado em desenvolvimento por ser um arquivo local, sem necessidade de processo de banco separado. É ideal para protótipos, testes e aplicações de usuário único. **PostgreSQL** é o padrão para produção: suporte a concorrência real (MVCC), tipos avançados, extensões e melhor desempenho sob carga. A migração do Prisma de SQLite para PostgreSQL exige apenas trocar o `provider` no `schema.prisma` e a `DATABASE_URL` — o restante do código permanece inalterado.
