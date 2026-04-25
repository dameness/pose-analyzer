import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
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
