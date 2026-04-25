# exercise-execution-service

Serviço NestJS standalone responsável por autenticação de usuários, catálogo de exercícios e registro de execuções. Roda na porta 3000, separado do serviço FastAPI (porta 8000), dentro do mesmo monorepo.

---

## Stack

- **NestJS 10** — framework HTTP
- **Prisma 7 + SQLite** (libsql wasm adapter) — banco de dados
- **@nestjs/jwt + passport-jwt** — autenticação JWT
- **@nestjs/config + Joi** — configuração e validação de env vars
- **class-validator + class-transformer** — validação de DTOs
- **bcrypt** — hash de senhas
- **@nestjs/swagger** — documentação em `/api-docs`
- **Jest + supertest** — testes unitários e E2E

---

## Estrutura

```
exercise-execution-service/
├── src/
│   ├── main.ts                          # bootstrap, Swagger, ValidationPipe global, CORS
│   ├── app.module.ts                    # módulo raiz com todos os módulos importados
│   ├── config/
│   │   └── env.validation.ts           # schema Joi para DATABASE_URL, JWT_SECRET, etc.
│   ├── prisma/
│   │   ├── prisma.module.ts            # @Global, exporta PrismaService
│   │   └── prisma.service.ts           # extends PrismaClient com PrismaLibSql adapter
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts          # POST /auth/register, POST /auth/login
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts             # PassportStrategy(Strategy)
│   │   ├── jwt-auth.guard.ts           # AuthGuard('jwt')
│   │   ├── auth.service.spec.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts         # GET /me
│   │   ├── users.service.ts
│   │   └── users.service.spec.ts
│   ├── exercises/
│   │   ├── exercises.module.ts
│   │   ├── exercises.controller.ts     # GET /exercises, GET /exercises/:id
│   │   ├── exercises.service.ts
│   │   └── exercises.service.spec.ts
│   └── executions/
│       ├── executions.module.ts
│       ├── executions.controller.ts    # GET/POST/PUT/DELETE /executions[/:id]
│       ├── executions.service.ts
│       ├── executions.service.spec.ts
│       └── dto/
│           ├── create-execution.dto.ts
│           └── update-execution.dto.ts
├── prisma/
│   ├── schema.prisma                   # modelos User, Exercise, ExerciseExecution
│   ├── seed.ts                         # upsert de 3 exercícios + 2 usuários de dev
│   ├── resolver-url-banco.ts           # utilitário: converte file:./ para file:// absoluto
│   └── migrations/
├── test/
│   ├── app.e2e-spec.ts                 # suite E2E (auth, /me, /exercises, /executions CRUD)
│   └── jest-e2e.json
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

---

## Contrato da API

### Auth

| Método | Rota           | Auth | Status de sucesso |
|--------|----------------|------|-------------------|
| POST   | /auth/register | —    | 201 + Location: /me |
| POST   | /auth/login    | —    | 200 `{ token, user }` |

### Users

| Método | Rota | Auth | Status |
|--------|------|------|--------|
| GET    | /me  | JWT  | 200 `{ user }` |

### Exercises

| Método | Rota            | Auth | Status |
|--------|-----------------|------|--------|
| GET    | /exercises      | —    | 200 `{ exercises }` |
| GET    | /exercises/:id  | —    | 200 `{ exercise }` |

### Executions

| Método | Rota               | Auth | Status |
|--------|--------------------|------|--------|
| GET    | /executions        | JWT  | 200 `{ executions }` |
| GET    | /executions/:id    | JWT  | 200 `{ execution }` |
| POST   | /executions        | JWT  | 201 + Location header |
| PUT    | /executions/:id    | JWT  | 200 `{ execution }` |
| DELETE | /executions/:id    | JWT  | 204 |

Ownership: GET/PUT/DELETE lançam `404` (não `403`) para execuções inexistentes ou de outro usuário — evita information leakage.

---

## Variáveis de ambiente

Copie `.env.example` para `.env`:

```
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="troque-isto-em-producao"
JWT_EXPIRES_IN="24h"
BCRYPT_ROUNDS=10
PORT=3000
NODE_ENV=development
```

---

## Como rodar

```bash
cd exercise-execution-service
npm install
npx prisma migrate dev       # cria o banco e as tabelas
npx prisma generate          # gera o Prisma Client
npx tsx prisma/seed.ts       # popula exercícios + usuários de dev
npm run start:dev            # http://localhost:3000
# Swagger em http://localhost:3000/api-docs
```

---

## Testes

```bash
npm test                     # unitários (20 testes, 5 suites)
npm run test:e2e             # E2E (15 testes contra o SQLite real — requer seed)
```

---

## Decisões de arquitetura

- **Prisma 7 com `@prisma/adapter-libsql`**: o motor wasm do Prisma 7 exige o adapter em vez de driver nativo. O helper `prisma/resolver-url-banco.ts` converte `file:./dev.db` → `file:///abs/path` porque o libsql não aceita caminhos relativos.
- **`@Res({ passthrough: true })`**: os endpoints que precisam setar status/headers customizados (POST register, POST executions) usam passthrough para manter o pipeline de interceptors do NestJS ativo.
- **`PrismaModule` como `@Global()`**: evita importar `PrismaModule` em cada módulo de domínio.
- **`NotFoundException` em lugar de `ForbiddenException`** para ownership: não revela se o recurso existe para outro usuário.
- **SQLite → PostgreSQL**: troca de banco é uma linha no `schema.prisma` (`provider = "postgresql"`) + novo `DATABASE_URL`. Nenhum código de aplicação muda.

---

## Histórico

O plano de migração Express → NestJS está em `docs/superpowers/plans/2026-04-24-exercise-execution-service-nest.md` (concluído).
