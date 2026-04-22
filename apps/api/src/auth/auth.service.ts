import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { cpfCnpj: dto.cpfCnpj },
          { telefone: dto.telefone },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Usuario ja cadastrado com este email, CPF/CNPJ ou telefone');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome,
        cpfCnpj: dto.cpfCnpj,
        email: dto.email,
        telefone: dto.telefone,
        senhaHash,
        role: dto.role,
        oabNumero: dto.oabNumero,
      },
    });

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.ativo) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const senhaValida = await bcrypt.compare(dto.senha, user.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    // Se 2FA esta habilitado, nao retorna tokens - exige TOTP primeiro
    if (user.twoFactorEnabled) {
      return {
        requiresTwoFactor: true,
        userId: user.id,
      };
    }

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  async loginAfter2fa(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.ativo) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', 'your-refresh-secret-change-in-production'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.ativo) {
        throw new UnauthorizedException('Token invalido');
      }

      // Invalida refresh tokens emitidos antes da ultima troca de senha.
      // payload.iat esta em segundos (UNIX time), passwordChangedAt em ms.
      if (user.passwordChangedAt && payload.iat) {
        const iatMs = payload.iat * 1000;
        if (user.passwordChangedAt.getTime() > iatMs) {
          throw new UnauthorizedException('Sessao invalidada. Faca login novamente.');
        }
      }

      return this.generateTokens(user.id, user.role);
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado');
    }
  }

  /**
   * Solicita recuperacao de senha.
   * Anti-enumeracao: sempre retorna sucesso, mesmo que o email nao exista.
   * Gera token aleatorio (32 bytes hex = 64 chars), salva com TTL de 10 min.
   * Se solicitar novamente, invalida o token anterior (sobrescreve).
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Anti-enumeracao: retorna sucesso silenciosamente se nao achar
    if (!user || !user.ativo) {
      this.logger.log(`[forgot-password] Email nao cadastrado ou inativo: ${email}`);
      return { success: true };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpiresAt: expiresAt,
      },
    });

    // Envia email (nao bloqueia a resposta se falhar)
    try {
      await this.emailService.enviarLinkRecuperacaoSenha(user.email, user.nome, token);
    } catch (err: any) {
      this.logger.error(`[forgot-password] Falha ao enviar email: ${err.message}`);
    }

    return { success: true };
  }

  /**
   * Redefine senha a partir do token.
   * Valida token existe, nao expirou e a senha tem tamanho minimo.
   * Apos redefinir: limpa o token e invalida refresh tokens (forca logout de outros devices).
   */
  async resetPassword(token: string, novaSenha: string) {
    if (!token || token.length < 10) {
      throw new BadRequestException('Token invalido');
    }

    if (novaSenha.length < 6) {
      throw new BadRequestException('A senha deve ter no minimo 6 caracteres');
    }

    const user = await this.prisma.user.findUnique({
      where: { resetPasswordToken: token },
    });

    if (!user || !user.ativo) {
      throw new BadRequestException('Link invalido ou expirado. Solicite um novo.');
    }

    if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
      // Limpa token expirado
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordToken: null, resetPasswordExpiresAt: null },
      });
      throw new BadRequestException('Link expirado. Solicite um novo.');
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualiza senha + limpa token + marca passwordChangedAt.
    // O campo passwordChangedAt eh usado no refresh() para invalidar
    // refresh tokens emitidos ANTES da troca de senha.
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        senhaHash,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        passwordChangedAt: new Date(),
      },
    });

    this.logger.log(`[reset-password] Senha redefinida com sucesso: ${user.email}`);
    return { success: true, email: user.email };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        cpfCnpj: true,
        email: true,
        telefone: true,
        role: true,
        oabNumero: true,
        ativo: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    return user;
  }

  private async generateTokens(userId: string, role: string) {
    const payload = { sub: userId, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET', 'your-refresh-secret-change-in-production'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
