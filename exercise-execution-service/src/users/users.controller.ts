import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { successExamples, errorExamples } from '../common/swagger-examples';

@ApiTags('Users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token inválido ou ausente',
  schema: { example: errorExamples.unauthorizedToken },
})
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  @ApiOkResponse({
    description: 'Dados do usuário autenticado',
    schema: { example: successExamples.meOk },
  })
  async me(@Request() req: { user: { id: number } }) {
    return { user: await this.usersService.getMe(req.user.id) };
  }
}
