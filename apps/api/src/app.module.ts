import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { EmailModule } from './email/email.module';
import { RagModule } from './rag/rag.module';
import { AuthModule } from './auth/auth.module';
import { ArbitragensModule } from './arbitragens/arbitragens.module';
import { PecasModule } from './pecas/pecas.module';
import { ProvasModule } from './provas/provas.module';
import { PrazosModule } from './prazos/prazos.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { SentencaModule } from './sentenca/sentenca.module';
import { AdminModule } from './admin/admin.module';
import { ChatModule } from './chat/chat.module';
import { PlanosModule } from './planos/planos.module';
import { CompromissoModule } from './compromisso/compromisso.module';
import { CertificadoDigitalModule } from './certificado-digital/certificado-digital.module';
import { ConvitesModule } from './convites/convites.module';
import { VerificacaoModule } from './verificacao/verificacao.module';
import { IaModule } from './ia/ia.module';
import { EventsModule } from './events/events.module';
import { PdfModule } from './pdf/pdf.module';
import { PdfController } from './pdf/pdf.controller';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    StorageModule,
    EmailModule,
    RagModule,
    EventsModule,
    AuthModule,
    ArbitragensModule,
    PecasModule,
    ProvasModule,
    PrazosModule,
    NotificacoesModule,
    SentencaModule,
    AdminModule,
    ChatModule,
    PlanosModule,
    CompromissoModule,
    CertificadoDigitalModule,
    ConvitesModule,
    VerificacaoModule,
    IaModule,
    PdfModule,
  ],
  controllers: [HealthController, PdfController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
