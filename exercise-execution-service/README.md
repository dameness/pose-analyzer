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

## Testes

```bash
npm test                   # 20 unitários
npm run test:e2e           # 15 E2E (requer seed)
```
