// Exemplos usados pelos decorators @ApiResponse para enriquecer a documentação
// gerada em /api-docs. Mantemos os objetos isolados do código de produção para
// evitar acoplamento — eles refletem a forma das respostas reais, mas não são
// usados em runtime.

const usuarioExample = {
  id: 1,
  email: 'alice@example.com',
  name: 'Alice',
  createdAt: '2026-04-25T00:36:33.229Z',
};

const exercicioExample = {
  id: 1,
  slug: 'squat',
  name: 'Agachamento',
  description: 'Exercício de agachamento livre.',
  createdAt: '2026-04-25T00:36:33.281Z',
};

const execucaoExample = {
  id: 42,
  userId: 1,
  exerciseId: 1,
  reps: 10,
  durationSec: 30,
  result: 'correct',
  score: 0.9,
  executedAt: '2026-04-25T12:00:00.000Z',
  createdAt: '2026-04-25T12:00:01.123Z',
  exercise: exercicioExample,
};

export const successExamples = {
  registerCreated: { user: usuarioExample },
  loginOk: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlhdCI6MTc...',
    user: usuarioExample,
  },
  meOk: { user: usuarioExample },
  exercisesList: { exercises: [exercicioExample] },
  exerciseDetail: { exercise: exercicioExample },
  executionsList: { executions: [execucaoExample] },
  executionDetail: { execution: execucaoExample },
  executionCreated: { execution: execucaoExample },
  executionUpdated: { execution: { ...execucaoExample, reps: 15 } },
};

export const errorExamples = {
  badRequest: {
    statusCode: 400,
    message: ['email must be an email', 'password must be longer than or equal to 6 characters'],
    error: 'Bad Request',
  },
  unauthorizedToken: {
    statusCode: 401,
    message: 'Unauthorized',
  },
  unauthorizedCredentials: {
    statusCode: 401,
    message: 'Invalid credentials',
    error: 'Unauthorized',
  },
  notFoundExercise: {
    statusCode: 404,
    message: 'Exercise not found',
    error: 'Not Found',
  },
  notFoundExecution: {
    statusCode: 404,
    message: 'Execution not found',
    error: 'Not Found',
  },
  conflictEmail: {
    statusCode: 409,
    message: 'Email already in use',
    error: 'Conflict',
  },
};
