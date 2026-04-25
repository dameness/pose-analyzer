import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';

@ApiTags('Exercises')
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista exercícios do catálogo' })
  @ApiOkResponse({ description: 'Lista de exercícios' })
  async list() {
    return { exercises: await this.exercisesService.listExercises() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um exercício' })
  @ApiOkResponse({ description: 'Detalhe do exercício' })
  @ApiNotFoundResponse({ description: 'Exercício não encontrado' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return { exercise: await this.exercisesService.getExercise(id) };
  }
}
