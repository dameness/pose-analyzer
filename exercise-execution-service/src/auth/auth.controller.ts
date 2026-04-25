import { Controller, Post, Body, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { successExamples, errorExamples } from '../common/swagger-examples';

@ApiTags('Auth')
@ApiBadRequestResponse({
  description: 'Dados de entrada inválidos',
  schema: { example: errorExamples.badRequest },
})
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cria conta de usuário' })
  @ApiCreatedResponse({
    description: 'Usuário criado; header Location aponta para /me',
    schema: { example: successExamples.registerCreated },
  })
  @ApiConflictResponse({
    description: 'Email já em uso',
    schema: { example: errorExamples.conflictEmail },
  })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.register(dto);
    res.status(HttpStatus.CREATED).location('/me');
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica e retorna JWT' })
  @ApiOkResponse({
    description: 'Token JWT e dados do usuário',
    schema: { example: successExamples.loginOk },
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciais inválidas',
    schema: { example: errorExamples.unauthorizedCredentials },
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
