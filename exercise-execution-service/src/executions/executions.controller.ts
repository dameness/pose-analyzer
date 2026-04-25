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
    @Res({ passthrough: true }) res: Response,
  ) {
    const execution = await this.executionsService.create(req.user.id, dto);
    res.status(HttpStatus.CREATED).location(`/executions/${execution.id}`);
    return { execution };
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
