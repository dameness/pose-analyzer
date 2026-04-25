# exercise-execution-service — NestJS Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Absorb `exercise-execution-service/` into the outer monorepo git control and rebuild it from Express.js to NestJS, preserving the exact API contract.

**Architecture:** Standalone NestJS service running on port 3000 (separate from FastAPI on port 8000), both inside the same monorepo. SQLite + Prisma now; switching to PostgreSQL later is a single `DATABASE_URL` env var change with no application code modifications.

**Tech Stack:** NestJS 10, @nestjs/jwt + passport-jwt, @nestjs/config + Joi, Prisma 6 + SQLite, class-validator + class-transformer, bcrypt, @nestjs/swagger, Jest + supertest

---

## File Structure

```
exercise-execution-service/
├── src/
│   ├── main.ts                              # bootstrap, Swagger, global pipes/filters
│   ├── app.module.ts                        # root module
│   ├── prisma/
│   │   ├── prisma.module.ts                 # @Global module, exports PrismaService
│   │   └── prisma.service.ts               # extends PrismaClient, handles connect/disconnect
│   ├── config/
│   │   └── env.validation.ts               # Joi schema for env vars
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts              # POST /auth/register, POST /auth/login
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts                 # PassportStrategy(Strategy)
│   │   ├── jwt-auth.guard.ts               # AuthGuard('jwt')
│   │   ├── auth.controller.spec.ts
│   │   ├── auth.service.spec.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts             # GET /me
│   │   ├── users.service.ts
│   │   └── users.service.spec.ts
│   ├── exercises/
│   │   ├── exercises.module.ts
│   │   ├── exercises.controller.ts         # GET /exercises, GET /exercises/:id
│   │   ├── exercises.service.ts
│   │   └── exercises.service.spec.ts
│   └── executions/
│       ├── executions.module.ts
│       ├── executions.controller.ts        # GET/POST/PUT/DELETE /executions[/:id]
│       ├── executions.service.ts
│       ├── executions.service.spec.ts
│       └── dto/
│           ├── create-execution.dto.ts
│           └── update-execution.dto.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── test/
│   └── app.e2e-spec.ts
├── .env.example
├── .gitignore
├── nest-cli.json
├── package.json
└── tsconfig.json
```

---

## Task 0: Absorb into outer monorepo

**Files:** `exercise-execution-service/.git` (delete), outer `.gitignore` (verify)

> **Warning:** Removing `exercise-execution-service/.git` permanently destroys the service's git history. The outer monorepo will start tracking it fresh.

- [ ] **Step 0.1: Remove the inner git repo**

```bash
cd /home/veplex13/pose-analyzer
rm -rf exercise-execution-service/.git
```

- [ ] **Step 0.2: Verify the outer repo now sees the files**

```bash
git status
# Expected: exercise-execution-service/ appears under "Untracked files"
```

- [ ] **Step 0.3: Add a .gitignore inside the service to block large/generated files**

Create `exercise-execution-service/.gitignore`:

```
node_modules/
dist/
.env
*.db
*.db-journal
```

- [ ] **Step 0.4: Stage and commit the current Express.js state**

```bash
git add exercise-execution-service/
git commit -m "chore: absorb exercise-execution-service into monorepo"
```

---

## Task 1: Teardown Express + Scaffold NestJS

**Files:** Delete all Express files, create NestJS scaffold in place

- [ ] **Step 1.1: Delete Express source files (keep .git-adjacent files)**

```bash
cd /home/veplex13/pose-analyzer/exercise-execution-service
rm -rf src/ postman/ node_modules/ dist/
rm -f package.json package-lock.json tsconfig.json README.md .env.example .gitignore
```

- [ ] **Step 1.2: Scaffold NestJS into the existing directory**

```bash
cd /home/veplex13/pose-analyzer

# --skip-git prevents nest from running git init
npx @nestjs/cli@latest new exercise-execution-service \
  --package-manager npm \
  --skip-git \
  --language TypeScript \
  --strict
# When prompted that the directory exists, confirm to proceed
```

- [ ] **Step 1.3: Remove scaffold boilerplate we won't use**

```bash
cd exercise-execution-service
rm src/app.controller.ts src/app.controller.spec.ts src/app.service.ts
```

- [ ] **Step 1.4: Install all project dependencies**

```bash
npm install @nestjs/jwt @nestjs/passport @nestjs/config @nestjs/swagger \
  passport passport-jwt \
  @prisma/client \
  class-validator class-transformer \
  bcrypt joi

npm install --save-dev \
  prisma \
  @types/passport-jwt \
  @types/bcrypt \
  @nestjs/testing \
  supertest \
  @types/supertest
```

- [ ] **Step 1.5: Create `.env.example`**

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="troque-isto-em-producao"
JWT_EXPIRES_IN="24h"
BCRYPT_ROUNDS=10
PORT=3000
NODE_ENV=development
```

- [ ] **Step 1.6: Update `.gitignore`**

```
node_modules/
dist/
.env
*.db
*.db-journal
```

- [ ] **Step 1.7: Commit scaffold**

```bash
cd /home/veplex13/pose-analyzer
git add exercise-execution-service/
git commit -m "chore: scaffold NestJS project in exercise-execution-service"
```

---

## Task 2: Prisma Setup

**Files:** `prisma/schema.prisma`, `src/prisma/prisma.service.ts`, `src/prisma/prisma.module.ts`

- [ ] **Step 2.1: Initialize Prisma**

```bash
cd exercise-execution-service
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 2.2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id         Int                 @id @default(autoincrement())
  email      String              @unique
  password   String
  name       String
  createdAt  DateTime            @default(now())
  executions ExerciseExecution[]
}

model Exercise {
  id          Int                 @id @default(autoincrement())
  slug        String              @unique
  name        String
  description String
  createdAt   DateTime            @default(now())
  executions  ExerciseExecution[]
}

model ExerciseExecution {
  id          Int      @id @default(autoincrement())
  userId      Int
  exerciseId  Int
  reps        Int
  durationSec Int
  result      String
  score       Float
  executedAt  DateTime
  createdAt   DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id])
  exercise Exercise @relation(fields: [exerciseId], references: [id])
}
```

> **PostgreSQL migration note:** This schema uses no SQLite-specific types. To migrate later: change `provider = "sqlite"` to `provider = "postgresql"` and update `DATABASE_URL`. Run `prisma migrate deploy`. No application code changes needed.

- [ ] **Step 2.3: Create migration and generate client**

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Expected: `prisma/migrations/` directory created, `node_modules/.prisma/client` generated.

- [ ] **Step 2.4: Write the failing PrismaService test**

Create `src/prisma/prisma.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await service.$disconnect();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('should connect to the database', async () => {
    await expect(service.$connect()).resolves.not.toThrow();
  });
});
```

```bash
npm test -- --testPathPattern=prisma.service
# Expected: FAIL — PrismaService not defined yet
```

- [ ] **Step 2.5: Implement PrismaService (GREEN)**

Create `src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

Create `src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```bash
npm test -- --testPathPattern=prisma.service
# Expected: PASS
```

- [ ] **Step 2.6: Commit**

```bash
cd /home/veplex13/pose-analyzer
git add exercise-execution-service/
git commit -m "feat(prisma): add PrismaService and module"
```

---

## Task 3: Config + AppModule

**Files:** `src/config/env.validation.ts`, `src/app.module.ts`

- [ ] **Step 3.1: Write env validation schema**

Create `src/config/env.validation.ts`:

```typescript
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  BCRYPT_ROUNDS: Joi.number().integer().positive().default(10),
  PORT: Joi.number().integer().positive().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
});
```

- [ ] **Step 3.2: Wire AppModule (placeholder imports — fill in as modules are built)**

Overwrite `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    PrismaModule,
    // AuthModule, UsersModule, ExercisesModule, ExecutionsModule — added per task
  ],
})
export class AppModule {}
```

---

## Task 4: Auth Module

**Files:** `src/auth/` (all files listed in structure above)

- [ ] **Step 4.1: Create DTOs**

`src/auth/dto/register.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  @MinLength(1)
  name: string;
}
```

`src/auth/dto/login.dto.ts`:

```typescript
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}
```

- [ ] **Step 4.2: Write failing AuthService tests**

Create `src/auth/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
};
const mockJwt = { sign: jest.fn().mockReturnValue('mock.jwt.token') };
const mockConfig = {
  get: jest.fn(
    (key: string) => ({ BCRYPT_ROUNDS: 10, JWT_EXPIRES_IN: '24h' })[key],
  ),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('returns user without password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        name: 'A',
        createdAt: new Date(),
      });
      const result = await service.register({
        email: 'a@b.com',
        password: 'senha123',
        name: 'A',
      });
      expect(result).toHaveProperty('id');
      expect(result).not.toHaveProperty('password');
    });

    it('throws ConflictException when email exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
      await expect(
        service.register({ email: 'a@b.com', password: 'senha123', name: 'A' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns token and user on valid credentials', async () => {
      const hash = await bcrypt.hash('senha123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        password: hash,
        name: 'A',
        createdAt: new Date(),
      });
      const result = await service.login({
        email: 'a@b.com',
        password: 'senha123',
      });
      expect(result).toHaveProperty('token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@x.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        password: hash,
        name: 'A',
        createdAt: new Date(),
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

```bash
npm test -- --testPathPattern=auth.service
# Expected: FAIL — AuthService not defined
```

- [ ] **Step 4.3: Implement AuthService (GREEN)**

Create `src/auth/auth.service.ts`:

```typescript
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already in use');

    const rounds = this.config.get<number>('BCRYPT_ROUNDS') ?? 10;
    const hashed = await bcrypt.hash(dto.password, rounds);

    return this.prisma.user.create({
      data: { email: dto.email, password: hashed, name: dto.name },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '24h';
    const token = this.jwtService.sign({ sub: user.id }, { expiresIn });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }
}
```

```bash
npm test -- --testPathPattern=auth.service
# Expected: PASS
```

- [ ] **Step 4.4: Implement JwtStrategy and JwtAuthGuard**

`src/auth/jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: { sub: number }) {
    return { id: payload.sub };
  }
}
```

`src/auth/jwt-auth.guard.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 4.5: Implement AuthController**

`src/auth/auth.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cria conta de usuário' })
  async register(@Body() dto: RegisterDto, @Res() res: Response) {
    const user = await this.authService.register(dto);
    return res.status(HttpStatus.CREATED).location('/me').json({ user });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica e retorna JWT' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

- [ ] **Step 4.6: Assemble AuthModule**

`src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '24h',
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  controllers: [AuthController],
  exports: [JwtAuthGuard, PassportModule],
})
export class AuthModule {}
```

- [ ] **Step 4.7: Add AuthModule to AppModule imports**

In `src/app.module.ts`, add `import { AuthModule } from './auth/auth.module';` and include `AuthModule` in the imports array.

- [ ] **Step 4.8: Run all auth tests and commit**

```bash
npm test -- --testPathPattern=auth
# Expected: PASS (auth.service.spec.ts)
```

```bash
cd /home/veplex13/pose-analyzer
git add exercise-execution-service/
git commit -m "feat(auth): implement AuthModule with JWT strategy, register and login"
```

---

## Task 5: Users Module

**Files:** `src/users/`

- [ ] **Step 5.1: Write failing UsersService test**

`src/users/users.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = { user: { findUnique: jest.fn() } };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('returns user without password', async () => {
    const user = { id: 1, email: 'a@b.com', name: 'A', createdAt: new Date() };
    mockPrisma.user.findUnique.mockResolvedValue(user);
    const result = await service.getMe(1);
    expect(result).toEqual(user);
    expect(result).not.toHaveProperty('password');
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getMe(999)).rejects.toThrow(NotFoundException);
  });
});
```

```bash
npm test -- --testPathPattern=users.service
# Expected: FAIL
```

- [ ] **Step 5.2: Implement UsersService + Controller + Module (GREEN)**

`src/users/users.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
```

`src/users/users.controller.ts`:

```typescript
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  async me(@Request() req: { user: { id: number } }) {
    return { user: await this.usersService.getMe(req.user.id) };
  }
}
```

`src/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 5.3: Add UsersModule to AppModule, run tests, commit**

```bash
npm test -- --testPathPattern=users.service
# Expected: PASS
```

```bash
cd /home/veplex13/pose-analyzer
git add exercise-execution-service/
git commit -m "feat(users): implement UsersModule with GET /me"
```

---

## Task 6: Exercises Module

**Files:** `src/exercises/`

- [ ] **Step 6.1: Write failing ExercisesService tests**

`src/exercises/exercises.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExercisesService } from './exercises.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = { exercise: { findMany: jest.fn(), findUnique: jest.fn() } };

describe('ExercisesService', () => {
  let service: ExercisesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ExercisesService>(ExercisesService);
    jest.clearAllMocks();
  });

  it('listExercises returns array', async () => {
    mockPrisma.exercise.findMany.mockResolvedValue([{ id: 1, slug: 'squat' }]);
    const result = await service.listExercises();
    expect(result).toHaveLength(1);
  });

  it('getExercise returns exercise when found', async () => {
    const ex = {
      id: 1,
      slug: 'squat',
      name: 'Agachamento',
      description: '...',
      createdAt: new Date(),
    };
    mockPrisma.exercise.findUnique.mockResolvedValue(ex);
    const result = await service.getExercise(1);
    expect(result).toEqual(ex);
  });

  it('getExercise throws NotFoundException when not found', async () => {
    mockPrisma.exercise.findUnique.mockResolvedValue(null);
    await expect(service.getExercise(999)).rejects.toThrow(NotFoundException);
  });
});
```

```bash
npm test -- --testPathPattern=exercises.service
# Expected: FAIL
```

- [ ] **Step 6.2: Implement ExercisesService + Controller + Module (GREEN)**

`src/exercises/exercises.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  async listExercises() {
    return this.prisma.exercise.findMany({ orderBy: { id: 'asc' } });
  }

  async getExercise(id: number) {
    const exercise = await this.prisma.exercise.findUnique({ where: { id } });
    if (!exercise) throw new NotFoundException('Exercise not found');
    return exercise;
  }
}
```

`src/exercises/exercises.controller.ts`:

```typescript
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';

@ApiTags('Exercises')
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista exercícios do catálogo' })
  async list() {
    return { exercises: await this.exercisesService.listExercises() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um exercício' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return { exercise: await this.exercisesService.getExercise(id) };
  }
}
```

`src/exercises/exercises.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { ExercisesController } from './exercises.controller';

@Module({
  providers: [ExercisesService],
  controllers: [ExercisesController],
})
export class ExercisesModule {}
```

- [ ] **Step 6.3: Add ExercisesModule to AppModule, run tests, commit**

```bash
npm test -- --testPathPattern=exercises.service
# Expected: PASS
```

```bash
cd /home/veplex13/pose-analyzer
git add exercise-execution-service/
git commit -m "feat(exercises): implement ExercisesModule with GET /exercises[/:id]"
```

---

## Task 7: Executions Module

**Files:** `src/executions/`

- [ ] **Step 7.1: Create DTOs**

`src/executions/dto/create-execution.dto.ts`:

```typescript
import {
  IsInt,
  IsPositive,
  IsIn,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExecutionDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  exerciseId: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  reps: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  durationSec: number;

  @ApiProperty({ enum: ['correct', 'incorrect'] })
  @IsIn(['correct', 'incorrect'])
  result: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  score: number;

  @ApiProperty({ example: '2026-04-24T10:00:00.000Z' })
  @IsDateString()
  executedAt: string;
}
```

`src/executions/dto/update-execution.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateExecutionDto } from './create-execution.dto';
import { OmitType } from '@nestjs/swagger';

export class UpdateExecutionDto extends PartialType(
  OmitType(CreateExecutionDto, ['exerciseId'] as const),
) {}
```

- [ ] **Step 7.2: Write failing ExecutionsService tests**

`src/executions/executions.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionsService } from './executions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  exerciseExecution: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  exercise: { findUnique: jest.fn() },
};

describe('ExecutionsService', () => {
  let service: ExecutionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ExecutionsService>(ExecutionsService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('returns executions for the user', async () => {
      mockPrisma.exerciseExecution.findMany.mockResolvedValue([{ id: 1 }]);
      const result = await service.list(1);
      expect(result).toHaveLength(1);
      expect(mockPrisma.exerciseExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } }),
      );
    });
  });

  describe('get', () => {
    it('returns execution when user owns it', async () => {
      mockPrisma.exerciseExecution.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
      });
      const result = await service.get(1, 1);
      expect(result).toHaveProperty('id', 1);
    });

    it('throws NotFoundException when execution does not exist', async () => {
      mockPrisma.exerciseExecution.findUnique.mockResolvedValue(null);
      await expect(service.get(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when execution belongs to another user', async () => {
      mockPrisma.exerciseExecution.findUnique.mockResolvedValue({
        id: 1,
        userId: 2,
      });
      await expect(service.get(1, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('throws NotFoundException when exercise does not exist', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null);
      await expect(
        service.create(1, {
          exerciseId: 99,
          reps: 10,
          durationSec: 30,
          result: 'correct',
          score: 0.9,
          executedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates and returns execution', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({ id: 1 });
      const created = {
        id: 1,
        userId: 1,
        exerciseId: 1,
        reps: 10,
        durationSec: 30,
        result: 'correct',
        score: 0.9,
        executedAt: new Date(),
        createdAt: new Date(),
      };
      mockPrisma.exerciseExecution.create.mockResolvedValue(created);
      const result = await service.create(1, {
        exerciseId: 1,
        reps: 10,
        durationSec: 30,
        result: 'correct',
        score: 0.9,
        executedAt: new Date().toISOString(),
      });
      expect(result).toHaveProperty('id', 1);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when execution not found or not owned', async () => {
      mockPrisma.exerciseExecution.findUnique.mockResolvedValue(null);
      await expect(service.update(1, 1, { reps: 5 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when execution not found or not owned', async () => {
      mockPrisma.exerciseExecution.findUnique.mockResolvedValue(null);
      await expect(service.remove(1, 1)).rejects.toThrow(NotFoundException);
    });
  });
});
```

```bash
npm test -- --testPathPattern=executions.service
# Expected: FAIL
```

- [ ] **Step 7.3: Implement ExecutionsService (GREEN)**

`src/executions/executions.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';

@Injectable()
export class ExecutionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOwned(id: number, userId: number) {
    const execution = await this.prisma.exerciseExecution.findUnique({
      where: { id },
      include: { exercise: true },
    });
    if (!execution || execution.userId !== userId) {
      throw new NotFoundException('Execution not found');
    }
    return execution;
  }

  async list(userId: number) {
    return this.prisma.exerciseExecution.findMany({
      where: { userId },
      include: { exercise: true },
      orderBy: { executedAt: 'desc' },
    });
  }

  async get(id: number, userId: number) {
    return this.findOwned(id, userId);
  }

  async create(userId: number, dto: CreateExecutionDto) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: dto.exerciseId },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');

    return this.prisma.exerciseExecution.create({
      data: {
        userId,
        exerciseId: dto.exerciseId,
        reps: dto.reps,
        durationSec: dto.durationSec,
        result: dto.result,
        score: dto.score,
        executedAt: new Date(dto.executedAt),
      },
      include: { exercise: true },
    });
  }

  async update(id: number, userId: number, dto: UpdateExecutionDto) {
    await this.findOwned(id, userId);
    return this.prisma.exerciseExecution.update({
      where: { id },
      data: {
        ...(dto.reps !== undefined && { reps: dto.reps }),
        ...(dto.durationSec !== undefined && { durationSec: dto.durationSec }),
        ...(dto.result !== undefined && { result: dto.result }),
        ...(dto.score !== undefined && { score: dto.score }),
        ...(dto.executedAt !== undefined && {
          executedAt: new Date(dto.executedAt),
        }),
      },
      include: { exercise: true },
    });
  }

  async remove(id: number, userId: number) {
    await this.findOwned(id, userId);
    await this.prisma.exerciseExecution.delete({ where: { id } });
  }
}
```

```bash
npm test -- --testPathPattern=executions.service
# Expected: PASS
```

- [ ] **Step 7.4: Implement ExecutionsController**

`src/executions/executions.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExecutionsService } from './executions.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';

@ApiTags('Executions')
@Controller('executions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista execuções do usuário' })
  async list(@Request() req: { user: { id: number } }) {
    return { executions: await this.executionsService.list(req.user.id) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma execução' })
  async get(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
  ) {
    return { execution: await this.executionsService.get(id, req.user.id) };
  }

  @Post()
  @ApiOperation({ summary: 'Registra execução de exercício' })
  async create(
    @Body() dto: CreateExecutionDto,
    @Request() req: { user: { id: number } },
    @Res() res: Response,
  ) {
    const execution = await this.executionsService.create(req.user.id, dto);
    return res
      .status(HttpStatus.CREATED)
      .location(`/executions/${execution.id}`)
      .json({ execution });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza execução' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExecutionDto,
    @Request() req: { user: { id: number } },
  ) {
    return {
      execution: await this.executionsService.update(id, req.user.id, dto),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove execução' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
  ) {
    await this.executionsService.remove(id, req.user.id);
  }
}
```

- [ ] **Step 7.5: Assemble ExecutionsModule**

`src/executions/executions.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { ExecutionsController } from './executions.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ExecutionsService],
  controllers: [ExecutionsController],
})
export class ExecutionsModule {}
```

- [ ] **Step 7.6: Add ExecutionsModule to AppModule, run tests, commit**

```bash
npm test -- --testPathPattern=executions.service
# Expected: PASS
```

```bash
cd /home/veplex13/pose-analyzer
git add exercise-execution-service/
git commit -m "feat(executions): implement ExecutionsModule with full CRUD"
```

---

## Task 8: Bootstrap + Global Exception Filter + Swagger

**Files:** `src/main.ts`, `src/filters/http-exception.filter.ts` (optional, NestJS default filter is sufficient)

- [ ] **Step 8.1: Write `src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Exercise Execution API')
    .setDescription('API para registro de execuções de exercícios')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port);
  console.log(`Exercise API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api-docs`);
}
bootstrap();
```

- [ ] **Step 8.2: Finalize AppModule with all modules**

`src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExercisesModule } from './exercises/exercises.module';
import { ExecutionsModule } from './executions/executions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    ExecutionsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 8.3: Update `package.json` scripts**

Verify these scripts exist (NestJS scaffold provides them):

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 8.4: Commit**

```bash
cd /home/veplex13/pose-analyzer
git add exercise-execution-service/
git commit -m "feat: bootstrap NestJS with ValidationPipe, CORS, and Swagger"
```

---

## Task 9: Seed Script

**Files:** `prisma/seed.ts`

- [ ] **Step 9.1: Write seed script**

`prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.exercise.upsert({
    where: { slug: 'squat' },
    update: {},
    create: {
      slug: 'squat',
      name: 'Agachamento',
      description: 'Exercício de agachamento livre.',
    },
  });
  await prisma.exercise.upsert({
    where: { slug: 'pushup' },
    update: {},
    create: {
      slug: 'pushup',
      name: 'Flexão',
      description: 'Flexão de braço no solo.',
    },
  });
  await prisma.exercise.upsert({
    where: { slug: 'situp' },
    update: {},
    create: {
      slug: 'situp',
      name: 'Abdominal',
      description: 'Abdominal clássico (sit-up).',
    },
  });

  const hash = await bcrypt.hash('senha123', 10);
  await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { email: 'alice@example.com', password: hash, name: 'Alice' },
  });
  await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: { email: 'bob@example.com', password: hash, name: 'Bob' },
  });

  console.log('Seed completo.');
}

main().finally(() => prisma.$disconnect());
```

Add to `package.json`:

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

- [ ] **Step 9.2: Run seed**

```bash
cd exercise-execution-service
npx prisma db seed
# Expected: "Seed completo."
```

---

## Task 10: E2E Tests

**Files:** `test/app.e2e-spec.ts`, `test/jest-e2e.json`

- [ ] **Step 10.1: Create `test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

- [ ] **Step 10.2: Write the E2E test suite**

`test/app.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Exercise Execution API (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let executionId: number;
  const email = `test_${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'senha123', name: 'Test User' });
    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('POST /auth/register (duplicate) → 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'senha123', name: 'Test User' });
    expect(res.status).toBe(409);
  });

  it('POST /auth/login → 200 with token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'senha123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  it('POST /auth/login (wrong password) → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('GET /me → 200 with user', async () => {
    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('email', email);
  });

  it('GET /me (no token) → 401', async () => {
    const res = await request(app.getHttpServer()).get('/me');
    expect(res.status).toBe(401);
  });

  it('GET /exercises → 200 with exercises array', async () => {
    const res = await request(app.getHttpServer()).get('/exercises');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.exercises)).toBe(true);
  });

  it('GET /exercises/1 → 200', async () => {
    const res = await request(app.getHttpServer()).get('/exercises/1');
    expect(res.status).toBe(200);
    expect(res.body.exercise).toHaveProperty('slug');
  });

  it('GET /exercises/9999 → 404', async () => {
    const res = await request(app.getHttpServer()).get('/exercises/9999');
    expect(res.status).toBe(404);
  });

  it('POST /executions → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/executions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        exerciseId: 1,
        reps: 10,
        durationSec: 30,
        result: 'correct',
        score: 0.9,
        executedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.execution).toHaveProperty('id');
    executionId = res.body.execution.id;
  });

  it('GET /executions → 200 with array', async () => {
    const res = await request(app.getHttpServer())
      .get('/executions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.executions)).toBe(true);
  });

  it('GET /executions/:id → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/executions/${executionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('PUT /executions/:id → 200 with updated data', async () => {
    const res = await request(app.getHttpServer())
      .put(`/executions/${executionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reps: 15 });
    expect(res.status).toBe(200);
    expect(res.body.execution.reps).toBe(15);
  });

  it('DELETE /executions/:id → 204', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/executions/${executionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('GET /executions/:id (deleted) → 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/executions/${executionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 10.3: Run E2E tests**

```bash
cd exercise-execution-service
npm run test:e2e
# Expected: all tests PASS (uses real SQLite dev.db)
```

- [ ] **Step 10.4: Commit**

```bash
cd /home/veplex13/pose-analyzer
git add exercise-execution-service/
git commit -m "test: add E2E test suite for all endpoints"
```

---

## Task 11: Final Verification

- [ ] **Step 11.1: Run all unit tests**

```bash
cd exercise-execution-service
npm test
# Expected: all PASS
```

- [ ] **Step 11.2: Run E2E tests**

```bash
npm run test:e2e
# Expected: all PASS
```

- [ ] **Step 11.3: Start and smoke-test manually**

```bash
# Copy .env.example to .env if not done
cp .env.example .env

npm run start:dev
# Expected: "Exercise API running on http://localhost:3000"
# Swagger at http://localhost:3000/api-docs
```

Test key flows via Swagger UI or curl:

```bash
curl -s http://localhost:3000/exercises | jq .
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"senha123"}' | jq .token
```

- [ ] **Step 11.4: Final commit**

```bash
cd /home/veplex13/pose-analyzer
git add exercise-execution-service/
git commit -m "chore: complete NestJS migration of exercise-execution-service"
```

---

## PostgreSQL Migration Path (Future)

When ready to switch from SQLite to PostgreSQL:

1. Update `prisma/schema.prisma`: change `provider = "sqlite"` to `provider = "postgresql"`
2. Set `DATABASE_URL="postgresql://user:password@host:5432/dbname"` in `.env`
3. Run `npx prisma migrate deploy` — Prisma generates a new migration from the existing schema
4. Run `npx prisma db seed` to repopulate exercises

No application code changes required.
