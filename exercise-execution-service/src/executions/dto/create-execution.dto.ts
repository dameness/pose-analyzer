import {
  IsInt,
  IsPositive,
  IsIn,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExecutionDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  exerciseId: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  reps: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  durationSec: number;

  @ApiProperty({ enum: ['correct', 'incorrect'] })
  @IsIn(['correct', 'incorrect'])
  result: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  score: number;

  @ApiProperty({ example: '2026-04-24T10:00:00.000Z' })
  @IsDateString()
  executedAt: string;
}
