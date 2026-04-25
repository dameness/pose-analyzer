# exercise-execution-service

Serviço NestJS de autenticação, catálogo de exercícios e registro de execuções (porta 3000).

Documentação completa: [`CLAUDE.md`](./CLAUDE.md).

## Quick start

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run start:dev          # http://localhost:3000
                           # Swagger: http://localhost:3000/api-docs
```

## Documentação da API

- **Swagger UI** em `/api-docs` (gerado dos decorators NestJS).
- **Postman** — importe `postman/exercise-execution-service.postman_collection.json` e o ambiente `postman/exercise-execution-service.postman_environment.json`. O test script de `Auth > Login` salva o token automaticamente.

## Testes

```bash
npm test                   # 20 unitários
npm run test:e2e           # 15 E2E (requer seed)
```
