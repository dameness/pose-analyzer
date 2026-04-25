import { PartialType } from '@nestjs/swagger';
import { CreateExecutionDto } from './create-execution.dto';
import { OmitType } from '@nestjs/swagger';

export class UpdateExecutionDto extends PartialType(
  OmitType(CreateExecutionDto, ['exerciseId'] as const),
) {}
