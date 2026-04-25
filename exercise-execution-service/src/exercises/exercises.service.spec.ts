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
