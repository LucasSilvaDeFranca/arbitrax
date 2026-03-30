import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const mockContext = (role: string, requiredRoles?: string[]): ExecutionContext => {
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'user-1', role } }),
      }),
    } as any;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles || null);
    return ctx;
  };

  it('deve permitir quando nao ha roles definidas', () => {
    const ctx = mockContext('REQUERENTE', undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deve permitir ADMIN acessar rota de ADMIN', () => {
    const ctx = mockContext('ADMIN', ['ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deve permitir ARBITRO acessar rota de ARBITRO', () => {
    const ctx = mockContext('ARBITRO', ['ARBITRO', 'ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deve bloquear REQUERENTE em rota de ADMIN', () => {
    const ctx = mockContext('REQUERENTE', ['ADMIN']);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('deve bloquear REQUERIDO em rota de ARBITRO', () => {
    const ctx = mockContext('REQUERIDO', ['ARBITRO']);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('deve permitir ADVOGADO em rota que aceita ADVOGADO', () => {
    const ctx = mockContext('ADVOGADO', ['REQUERENTE', 'ADVOGADO', 'ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
