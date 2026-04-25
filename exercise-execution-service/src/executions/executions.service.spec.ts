import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionsService } from './executions.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

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
