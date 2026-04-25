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
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExecutionsService } from './executions.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';

@ApiTags('Executions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token inválido ou ausente' })
@Controller('executions')
@UseGuards(JwtAuthGuard)
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista execuções do usuário' })
  @ApiOkResponse({ description: 'Lista de execuções do usuário autenticado' })
  async list(@Request() req: { user: { id: number } }) {
    return { executions: await this.executionsService.list(req.user.id) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma execução' })
  @ApiOkResponse({ description: 'Detalhe da execução' })
  @ApiNotFoundResponse({ description: 'Execução não encontrada ou de outro usuário' })
  async get(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
  ) {
    return { execution: await this.executionsService.get(id, req.user.id) };
  }

  @Post()
  @ApiOperation({ summary: 'Registra execução de exercício' })
  @ApiCreatedResponse({ description: 'Execução criada; header Location aponta para o recurso' })
  @ApiNotFoundResponse({ description: 'Exercício referenciado não existe' })
  @ApiBadRequestResponse({ description: 'Dados de entrada inválidos' })
  async create(
    @Body() dto: CreateExecutionDto,
    @Request() req: { user: { id: number } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const execution = await this.executionsService.create(req.user.id, dto);
    res.status(HttpStatus.CREATED).location(`/executions/${execution.id}`);
    return { execution };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza execução' })
  @ApiOkResponse({ description: 'Execução atualizada' })
  @ApiNotFoundResponse({ description: 'Execução não encontrada ou de outro usuário' })
  @ApiBadRequestResponse({ description: 'Dados de entrada inválidos' })
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
  @ApiNoContentResponse({ description: 'Execução removida' })
  @ApiNotFoundResponse({ description: 'Execução não encontrada ou de outro usuário' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
  ) {
    await this.executionsService.remove(id, req.user.id);
  }
}
