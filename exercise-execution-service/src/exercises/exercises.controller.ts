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
