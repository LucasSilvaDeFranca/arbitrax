import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TwoFactorService } from './two-factor.service';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('2FA')
@Controller('api/v1/auth/2fa')
export class TwoFactorController {
  constructor(
    private twoFactorService: TwoFactorService,
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ARBITRO', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gerar segredo TOTP e QR code para Google Authenticator' })
  async setup(@Request() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA ja esta ativado para esta conta');
    }

    const { secret, otpauthUrl, qrCodeDataUrl } =
      await this.twoFactorService.generateTotpSecret(user.email);

    // Store secret temporarily (not enabled yet until verified)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });

    return { otpauthUrl, qrCodeDataUrl };
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ARBITRO', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar token TOTP e ativar 2FA' })
  async verify(@Request() req: any, @Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token TOTP e obrigatorio');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        '2FA nao foi configurado. Execute /setup primeiro.',
      );
    }

    const isValid = this.twoFactorService.verifyToken(
      user.twoFactorSecret,
      token,
    );

    if (!isValid) {
      throw new BadRequestException('Token TOTP invalido');
    }

    // Enable 2FA
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    return { message: '2FA ativado com sucesso' };
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validar token TOTP durante o fluxo de login e retornar tokens JWT' })
  async validate(
    @Body('userId') userId: string,
    @Body('token') token: string,
  ) {
    if (!userId || !token) {
      throw new BadRequestException('userId e token sao obrigatorios');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA nao esta ativado para esta conta');
    }

    const isValid = this.twoFactorService.verifyToken(
      user.twoFactorSecret,
      token,
    );

    if (!isValid) {
      throw new UnauthorizedException('Token TOTP invalido');
    }

    // Retornar tokens JWT apos validacao 2FA bem-sucedida
    return this.authService.loginAfter2fa(user.id);
  }
}
