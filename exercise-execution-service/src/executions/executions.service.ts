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
