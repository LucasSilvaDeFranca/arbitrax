import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { ArbitragensModule } from './arbitragens/arbitragens.module';
import { PecasModule } from './pecas/pecas.module';
import { ProvasModule } from './provas/provas.module';
import { PrazosModule } from './prazos/prazos.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { SentencaModule } from './sentenca/sentenca.module';
import { AdminModule } from './admin/admin.module';
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
    PrazosModule,
    NotificacoesModule,
    SentencaModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
