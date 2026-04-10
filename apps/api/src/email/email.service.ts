import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor(private config: ConfigService) {
    this.fromEmail = this.config.get('SMTP_FROM', 'contato@arbitrax.com.br');

    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp-relay.brevo.com'),
      port: Number(this.config.get('SMTP_PORT', '587')),
      secure: false,
      auth: {
        user: this.config.get('SMTP_USER', ''),
        pass: this.config.get('SMTP_PASS', ''),
      },
    });
  }

  /**
   * APP_URL no .env e uma lista de origins separada por virgula (usado pra CORS).
   * Para links em emails, usa o PRIMEIRO URL da lista (canonical).
   * Ex: "https://arbitrax.com.br,https://www.arbitrax.com.br" -> "https://arbitrax.com.br"
   */
  private getFrontendUrl(): string {
    const raw = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const first = raw.split(',')[0].trim().replace(/\/$/, '');
    return first || 'http://localhost:3000';
  }

  async send(to: string, subject: string, html: string) {
    if (!this.config.get('SMTP_USER')) {
      this.logger.warn(`Email nao enviado (SMTP nao configurado): ${subject} -> ${to}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"ArbitraX" <${this.fromEmail}>`,
        to,
        subject,
        html: this.wrapTemplate(subject, html),
      });
      this.logger.log(`Email enviado: ${subject} -> ${to}`);
    } catch (err: any) {
      this.logger.error(`Erro ao enviar email: ${err.message}`);
    }
  }

  // ── Templates de email ──

  async enviarConvite(email: string, nome: string, caso: { numero: string; objeto: string; requerenteNome: string; valorCausa: number; conviteToken: string }) {
    const link = `${this.getFrontendUrl()}/convite/${caso.conviteToken}`;
    await this.send(email, `Convite para Arbitragem - ${caso.numero}`, `
      <h2>Voce foi convidado para uma arbitragem</h2>
      <p>Prezado(a) <strong>${nome}</strong>,</p>
      <p>Voce esta recebendo este convite para participar de um procedimento de arbitragem digital via ArbitraX.</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:4px 0;"><strong>Caso:</strong> ${caso.numero}</p>
        <p style="margin:4px 0;"><strong>Requerente:</strong> ${caso.requerenteNome}</p>
        <p style="margin:4px 0;"><strong>Valor:</strong> R$ ${caso.valorCausa.toLocaleString('pt-BR')}</p>
        <p style="margin:4px 0;"><strong>Objeto:</strong> ${caso.objeto.substring(0, 200)}...</p>
      </div>
      <p>O procedimento sera conduzido 100% online, garantindo praticidade e seguranca.</p>
      <p>Para aderir, voce tem <strong>5 dias uteis</strong>. Clique no botao abaixo:</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${link}" style="background:#1e40af;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
          Responder Convite
        </a>
      </div>
      <p style="font-size:12px;color:#999;">Se voce nao reconhece esta solicitacao, ignore este email.</p>
    `);
  }

  async enviarNotificacaoPrazo(email: string, nome: string, prazo: { tipo: string; diasRestantes: number; casoNumero: string }) {
    const urgencia = prazo.diasRestantes <= 1 ? '🔴 URGENTE' : prazo.diasRestantes <= 3 ? '🟡 Atencao' : '🟢 Lembrete';
    await this.send(email, `${urgencia} - Prazo ${prazo.tipo} - ${prazo.casoNumero}`, `
      <h2>${urgencia}: Prazo de ${prazo.tipo.toLowerCase().replace(/_/g, ' ')}</h2>
      <p>Prezado(a) <strong>${nome}</strong>,</p>
      <p>Voce tem um prazo ${prazo.diasRestantes === 0 ? '<strong style="color:red;">VENCENDO HOJE</strong>' : `vencendo em <strong>${prazo.diasRestantes} dia(s)</strong>`} no caso <strong>${prazo.casoNumero}</strong>.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${this.getFrontendUrl()}/dashboard" style="background:#1e40af;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Acessar Plataforma
        </a>
      </div>
    `);
  }

  async enviarNotificacaoSentenca(email: string, nome: string, caso: { numero: string; acao: string; codigoVerif?: string }) {
    await this.send(email, `Sentenca ${caso.acao} - ${caso.numero}`, `
      <h2>Sentenca Arbitral - ${caso.acao}</h2>
      <p>Prezado(a) <strong>${nome}</strong>,</p>
      <p>A sentenca do caso <strong>${caso.numero}</strong> foi <strong>${caso.acao.toLowerCase()}</strong>.</p>
      ${caso.codigoVerif ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
          <p style="margin:0;color:#666;">Codigo de verificacao:</p>
          <p style="margin:8px 0;font-size:24px;font-weight:bold;font-family:monospace;color:#166534;">${caso.codigoVerif}</p>
        </div>
      ` : ''}
      <div style="text-align:center;margin:30px 0;">
        <a href="${this.getFrontendUrl()}/dashboard" style="background:#1e40af;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Ver Sentenca
        </a>
      </div>
    `);
  }

  async enviarCompromissoPronto(email: string, nome: string, caso: { numero: string; arbitragemId: string }) {
    const link = `${this.getFrontendUrl()}/arbitragens/${caso.arbitragemId}/compromisso`;
    await this.send(email, `Compromisso Arbitral pronto - ${caso.numero}`, `
      <h2>Compromisso Arbitral disponivel para assinatura</h2>
      <p>Prezado(a) <strong>${nome}</strong>,</p>
      <p>O Termo de Compromisso Arbitral do caso <strong>${caso.numero}</strong> esta pronto para sua assinatura.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${link}" style="background:#1e40af;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Assinar Compromisso
        </a>
      </div>
    `);
  }

  async enviarCasoAceitoRecusado(email: string, nome: string, caso: { numero: string; aceito: boolean; requeridoNome: string }) {
    await this.send(email, `Arbitragem ${caso.aceito ? 'Aceita' : 'Recusada'} - ${caso.numero}`, `
      <h2>Arbitragem ${caso.aceito ? 'Aceita' : 'Recusada'}</h2>
      <p>Prezado(a) <strong>${nome}</strong>,</p>
      <p>O requerido <strong>${caso.requeridoNome}</strong> ${caso.aceito ? '<strong style="color:green;">ACEITOU</strong>' : '<strong style="color:red;">RECUSOU</strong>'} participar da arbitragem <strong>${caso.numero}</strong>.</p>
      ${caso.aceito ? '<p>O proximo passo e a assinatura do Compromisso Arbitral.</p>' : '<p>O caso foi encerrado.</p>'}
      <div style="text-align:center;margin:30px 0;">
        <a href="${this.getFrontendUrl()}/dashboard" style="background:#1e40af;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Acessar Plataforma
        </a>
      </div>
    `);
  }

  async enviarCodigoAssinatura(email: string, nome: string, codigo: string, casoNumero: string) {
    await this.send(email, `Codigo de assinatura - ${casoNumero}`, `
      <h2>Codigo de Assinatura Digital</h2>
      <p>Prezado(a) <strong>${nome}</strong>,</p>
      <p>Voce solicitou assinar o Termo de Compromisso Arbitral do caso <strong>${casoNumero}</strong>.</p>
      <p>Seu codigo de verificacao:</p>
      <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
        <p style="margin:0;font-size:36px;font-weight:bold;font-family:'Courier New',monospace;letter-spacing:8px;color:#166534;">${codigo}</p>
      </div>
      <p style="color:#666;font-size:13px;">Este codigo e valido por <strong>10 minutos</strong>. Nao compartilhe com ninguem.</p>
      <p style="color:#999;font-size:12px;margin-top:20px;">Se voce nao solicitou esta assinatura, ignore este email.</p>
    `);
  }

  // ── Template wrapper ──

  private wrapTemplate(title: string, body: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 50%,#7c3aed 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:28px;font-weight:bold;letter-spacing:1px;">ArbitraX</h1>
      <p style="margin:5px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">A justica do futuro, hoje!</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      ${body}
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px;color:#999;font-size:11px;">
      <p>ArbitraX - Arbitragem Virtual | Lei 9.307/96</p>
      <p>Este email foi enviado automaticamente. Nao responda.</p>
    </div>
  </div>
</body>
</html>`;
  }
}
