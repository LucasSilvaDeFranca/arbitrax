import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwt = {
    signAsync: jest.fn().mockResolvedValue('mock-token'),
    verify: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, def: string) => def),
  };

  const mockEmail = {
    enviarLinkRecuperacaoSenha: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = {
      nome: 'Carlos Silva',
      cpfCnpj: '12345678900',
      email: 'carlos@test.com',
      telefone: '+5511999999999',
      senha: 'senha123',
      role: 'USUARIO' as any,
    };

    it('deve criar usuario com sucesso', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'uuid-1',
        nome: dto.nome,
        email: dto.email,
        role: dto.role,
      });

      const result = await service.register(dto);

      expect(result.user.nome).toBe('Carlos Silva');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('deve rejeitar email duplicado', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('deve retornar tokens com credenciais validas', async () => {
      const senhaHash = await bcrypt.hash('senha123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        nome: 'Carlos',
        email: 'carlos@test.com',
        role: 'USUARIO',
        senhaHash,
        ativo: true,
      });

      const result = await service.login({
        email: 'carlos@test.com',
        senha: 'senha123',
      });

      expect((result as any).user.email).toBe('carlos@test.com');
      expect((result as any).accessToken).toBeDefined();
    });

    it('deve rejeitar email inexistente', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'naoexiste@test.com', senha: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar senha incorreta', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        senhaHash: await bcrypt.hash('senha_correta', 10),
        ativo: true,
      });

      await expect(
        service.login({ email: 'carlos@test.com', senha: 'senha_errada' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar usuario inativo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        senhaHash: await bcrypt.hash('senha123', 10),
        ativo: false,
      });

      await expect(
        service.login({ email: 'carlos@test.com', senha: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('deve gerar token e enviar email se usuario existir', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        nome: 'Carlos',
        email: 'carlos@test.com',
        ativo: true,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.forgotPassword('carlos@test.com');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'uuid-1' },
          data: expect.objectContaining({
            resetPasswordToken: expect.any(String),
            resetPasswordExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect(mockEmail.enviarLinkRecuperacaoSenha).toHaveBeenCalledWith(
        'carlos@test.com',
        'Carlos',
        expect.any(String),
      );

      // Token deve ser 64 chars hex (32 bytes)
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.resetPasswordToken).toMatch(/^[a-f0-9]{64}$/);

      // Expiracao deve ser ~10 min no futuro
      const expiresAt = updateCall.data.resetPasswordExpiresAt as Date;
      const diffMin = (expiresAt.getTime() - Date.now()) / 60000;
      expect(diffMin).toBeGreaterThan(9.5);
      expect(diffMin).toBeLessThan(10.5);
    });

    it('deve retornar sucesso silencioso se email nao existir (anti-enumeracao)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('naoexiste@test.com');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockEmail.enviarLinkRecuperacaoSenha).not.toHaveBeenCalled();
    });

    it('deve retornar sucesso silencioso se usuario estiver inativo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'carlos@test.com',
        ativo: false,
      });

      const result = await service.forgotPassword('carlos@test.com');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockEmail.enviarLinkRecuperacaoSenha).not.toHaveBeenCalled();
    });

    it('deve gerar tokens diferentes em chamadas consecutivas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        nome: 'Carlos',
        email: 'carlos@test.com',
        ativo: true,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.forgotPassword('carlos@test.com');
      await service.forgotPassword('carlos@test.com');

      const token1 = mockPrisma.user.update.mock.calls[0][0].data.resetPasswordToken;
      const token2 = mockPrisma.user.update.mock.calls[1][0].data.resetPasswordToken;
      expect(token1).not.toBe(token2);
    });

    it('deve normalizar email (lowercase + trim)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.forgotPassword('  CARLOS@TEST.COM  ');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'carlos@test.com' },
      });
    });

    it('deve retornar sucesso mesmo se envio de email falhar', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        nome: 'Carlos',
        email: 'carlos@test.com',
        ativo: true,
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockEmail.enviarLinkRecuperacaoSenha.mockRejectedValueOnce(new Error('SMTP down'));

      const result = await service.forgotPassword('carlos@test.com');
      expect(result).toEqual({ success: true });
    });
  });

  describe('resetPassword', () => {
    const validToken = 'a'.repeat(64);
    const validSenha = 'novaSenha123';

    it('deve redefinir senha com token valido', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000); // 5 min no futuro
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'carlos@test.com',
        ativo: true,
        resetPasswordToken: validToken,
        resetPasswordExpiresAt: futureDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.resetPassword(validToken, validSenha);

      expect(result).toEqual({ success: true, email: 'carlos@test.com' });

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.senhaHash).toBeDefined();
      expect(updateCall.data.resetPasswordToken).toBeNull();
      expect(updateCall.data.resetPasswordExpiresAt).toBeNull();
      expect(updateCall.data.passwordChangedAt).toBeInstanceOf(Date);

      // Valida que o hash gerado casa com a senha
      const hashMatches = await bcrypt.compare(validSenha, updateCall.data.senhaHash);
      expect(hashMatches).toBe(true);
    });

    it('deve rejeitar token invalido (nao existe no DB)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword(validToken, validSenha)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('deve rejeitar token expirado e limpar campos', async () => {
      const pastDate = new Date(Date.now() - 60 * 1000); // 1 min no passado
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'carlos@test.com',
        ativo: true,
        resetPasswordToken: validToken,
        resetPasswordExpiresAt: pastDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await expect(service.resetPassword(validToken, validSenha)).rejects.toThrow(
        /expirado/i,
      );

      // Deve limpar token expirado
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.resetPasswordToken).toBeNull();
      expect(updateCall.data.resetPasswordExpiresAt).toBeNull();
      expect(updateCall.data.senhaHash).toBeUndefined();
    });

    it('deve rejeitar senha menor que 6 caracteres', async () => {
      await expect(service.resetPassword(validToken, '12345')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('deve rejeitar token vazio ou muito curto', async () => {
      await expect(service.resetPassword('', validSenha)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword('abc', validSenha)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve rejeitar se usuario estiver inativo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'carlos@test.com',
        ativo: false,
        resetPasswordToken: validToken,
        resetPasswordExpiresAt: new Date(Date.now() + 60000),
      });

      await expect(service.resetPassword(validToken, validSenha)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('nao deve reutilizar o mesmo token apos uso', async () => {
      // Primeira chamada: sucesso
      const futureDate = new Date(Date.now() + 5 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'uuid-1',
        email: 'carlos@test.com',
        ativo: true,
        resetPasswordToken: validToken,
        resetPasswordExpiresAt: futureDate,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.resetPassword(validToken, validSenha);

      // Segunda chamada: token foi limpo, nao acha mais
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.resetPassword(validToken, validSenha)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refresh (invalidacao por troca de senha)', () => {
    it('deve rejeitar refresh token emitido antes da ultima troca de senha', async () => {
      const iatSegundos = Math.floor(Date.now() / 1000) - 3600; // iat 1h atras
      const passwordChangedAt = new Date(); // senha trocada agora

      mockJwt.verify.mockReturnValue({ sub: 'uuid-1', role: 'USUARIO', iat: iatSegundos });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        role: 'USUARIO',
        ativo: true,
        passwordChangedAt,
      });

      await expect(service.refresh('stale-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve aceitar refresh token emitido apos a troca de senha', async () => {
      const iatSegundos = Math.floor(Date.now() / 1000); // iat agora
      const passwordChangedAt = new Date(Date.now() - 3600 * 1000); // senha trocada 1h atras

      mockJwt.verify.mockReturnValue({ sub: 'uuid-1', role: 'USUARIO', iat: iatSegundos });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        role: 'USUARIO',
        ativo: true,
        passwordChangedAt,
      });

      const result = await service.refresh('fresh-refresh-token');
      expect(result.accessToken).toBe('mock-token');
    });

    it('deve aceitar refresh se usuario nunca trocou senha (passwordChangedAt null)', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'uuid-1', role: 'USUARIO', iat: 12345 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        role: 'USUARIO',
        ativo: true,
        passwordChangedAt: null,
      });

      const result = await service.refresh('any-token');
      expect(result.accessToken).toBe('mock-token');
    });
  });
});
