import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwt = {
    signAsync: jest.fn().mockResolvedValue('mock-token'),
    verify: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, def: string) => def),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
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
      role: 'REQUERENTE' as any,
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
        role: 'REQUERENTE',
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
});
