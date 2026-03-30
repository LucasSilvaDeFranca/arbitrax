import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { ArbitragensModule } from './arbitragens/arbitragens.module';
import { PecasModule } from './pecas/pecas.module';
import { ProvasModule } from './provas/provas.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    AuthModule,
    ArbitragensModule,
    PecasModule,
    ProvasModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
