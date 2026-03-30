import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get('api/health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'error', database: 'disconnected', timestamp: new Date().toISOString() };
    }
  }
}
