import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ZapSignService } from './zapsign.service';
import { EventsService } from '../events/events.service';
import { PdfService } from '../pdf/pdf.service';
import { StorageService } from '../storage/storage.service';
import { CertificadoDigitalService } from '../certificado-digital/certificado-digital.service';
import { PdfSignerService } from '../certificado-digital/pdf-signer.service';
import * as crypto from 'crypto';

@Injectable()
export class CompromissoService {
  private readonly logger = new Logger(CompromissoService.name);

  constructor(
    private prisma: PrismaService,
    private zapSign: ZapSignService,
    private events: EventsService,
    private pdfService: PdfService,
    private storage: StorageService,
    private certificadoService: CertificadoDigitalService,
    private pdfSignerService: PdfSignerService,
  ) {}

  /** Gerar compromisso arbitral, PDF e enviar para assinatura.
   *  Se allowReplace=true, regenera sobrescrevendo compromisso existente que ainda nao foi assinado. */
  async gerar(arbitragemId: string, options: { allowReplace?: boolean } = {}) {
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: {
        requerente: true,
        requerido: true,
        arbitros: { include: { arbitro: true } },
      },
    });

    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');
    if (!arb.requerido) throw new BadRequestException('Requerido nao vinculado');

    // Verificar se ja existe
    const existing = await this.prisma.compromisso.findUnique({
      where: { arbitragemId },
    });
    if (existing) {
      if (!options.allowReplace) {
        throw new BadRequestException('Compromisso ja gerado para este caso');
      }
      // Nao substituir se alguem ja assinou
      if (existing.assinReqAt || existing.assinReqdoAt) {
        throw new BadRequestException('Compromisso ja possui assinaturas - nao pode ser substituido');
      }
      // Deletar o anterior pra criar um novo
      await this.prisma.compromisso.delete({ where: { id: existing.id } });
      this.logger.log(`Compromisso anterior ${existing.id} removido para regeneracao`);
    }

    // Gerar HTML do termo
    const html = this.gerarHtmlCompromisso(arb);
    const htmlHash = crypto.createHash('sha256').update(html).digest('hex');

    // Enviar para ZapSign
    const arbitroNome = arb.arbitros?.[0]?.arbitro?.nome || 'A designar';
    const zapDoc = await this.zapSign.criarDocumento({
      nome: `Compromisso Arbitral - ${arb.numero}`,
      htmlContent: html,
      signatarios: [
        { nome: arb.requerente.nome, email: arb.requerente.email, cpf: arb.requerente.cpfCnpj },
        { nome: arb.requerido.nome, email: arb.requerido.email, cpf: arb.requerido.cpfCnpj },
      ],
    });

    // Gerar PDF do compromisso
    const { buffer: pdfBuffer, hash: pdfHash } = await this.pdfService.gerarCompromissoPdf({
      numero: arb.numero,
      objeto: arb.objeto,
      valorCausa: Number(arb.valorCausa),
      categoria: arb.categoria,
      requerenteNome: arb.requerente.nome,
      requerenteCpfCnpj: arb.requerente.cpfCnpj,
      requeridoNome: arb.requerido.nome,
      requeridoCpfCnpj: arb.requerido.cpfCnpj,
      arbitroNome,
    });

    // Upload PDF to storage
    const storageKey = `arbitragens/${arbitragemId}/compromisso/compromisso-${arb.numero}.pdf`;
    const uploaded = await this.storage.upload(pdfBuffer, storageKey, 'application/pdf');

    const compromisso = await this.prisma.compromisso.create({
      data: {
        arbitragemId,
        hashSha256: pdfHash,
        pdfUrl: uploaded.url,
        clicksignKey: zapDoc?.token || null,
        status: zapDoc ? 'enviado' : 'pendente',
      },
    });

    // Criar notificacoes
    await this.prisma.notificacao.create({
      data: {
        userId: arb.requerenteId,
        titulo: 'Compromisso Arbitral para assinar',
        mensagem: `O Termo de Compromisso Arbitral do caso ${arb.numero} esta disponivel para assinatura.`,
        tipo: 'sistema',
        link: `/arbitragens/${arbitragemId}/compromisso`,
      },
    });

    if (arb.requeridoId) {
      await this.prisma.notificacao.create({
        data: {
          userId: arb.requeridoId,
          titulo: 'Compromisso Arbitral para assinar',
          mensagem: `O Termo de Compromisso Arbitral do caso ${arb.numero} esta disponivel para assinatura.`,
          tipo: 'sistema',
          link: `/arbitragens/${arbitragemId}/compromisso`,
        },
      });
    }

    return {
      ...compromisso,
      signatarios: zapDoc?.signers?.map((s) => ({
        nome: s.name,
        email: s.email,
        signUrl: s.sign_url,
        status: s.status,
      })) || [],
    };
  }

  /** Regerar compromisso com verificacao de autorizacao (admin ou parte do caso) */
  async regerarComAutorizacao(arbitragemId: string, userId: string, userRole: string) {
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      select: {
        requerenteId: true,
        requeridoId: true,
        advRequerenteId: true,
        advRequeridoId: true,
      },
    });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    const isParte =
      arb.requerenteId === userId ||
      arb.requeridoId === userId ||
      arb.advRequerenteId === userId ||
      arb.advRequeridoId === userId;

    if (userRole !== 'ADMIN' && !isParte) {
      throw new BadRequestException('Sem autorizacao para regerar compromisso');
    }

    return this.gerar(arbitragemId, { allowReplace: true });
  }

  /** Consultar status do compromisso */
  async consultar(arbitragemId: string) {
    const compromisso = await this.prisma.compromisso.findUnique({
      where: { arbitragemId },
    });

    if (!compromisso) throw new NotFoundException('Compromisso nao encontrado');

    // Se tiver token ZapSign, consultar status atualizado
    let signatarios: any[] = [];
    if (compromisso.clicksignKey) {
      const zapDoc = await this.zapSign.consultarDocumento(compromisso.clicksignKey);
      if (zapDoc) {
        signatarios = zapDoc.signers.map((s) => ({
          nome: s.name,
          email: s.email,
          signUrl: s.sign_url,
          status: s.status,
        }));

        // Verificar se todos assinaram
        const todosAssinaram = zapDoc.signers.every((s) => s.status === 'signed');
        if (todosAssinaram && compromisso.status !== 'assinado') {
          await this.prisma.compromisso.update({
            where: { id: compromisso.id },
            data: {
              status: 'assinado',
              assinReqAt: new Date(),
              assinReqdoAt: new Date(),
            },
          });

          // Avancar status da arbitragem
          await this.prisma.arbitragem.update({
            where: { id: arbitragemId },
            data: { status: 'EM_INSTRUCAO' },
          });

          compromisso.status = 'assinado';
        }
      }
    }

    return { ...compromisso, signatarios };
  }

  /** Assinatura digital com certificado A1 */
  async assinarDigital(arbitragemId: string, userId: string) {
    // 1. Find compromisso
    const compromisso = await this.prisma.compromisso.findUnique({
      where: { arbitragemId },
    });
    if (!compromisso) {
      throw new NotFoundException('Compromisso nao encontrado');
    }

    // 2. Check PDF exists
    if (!compromisso.pdfUrl) {
      throw new BadRequestException('PDF do compromisso ainda nao foi gerado');
    }

    // 3. Find arbitragem to check user role
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
    });
    if (!arb) {
      throw new NotFoundException('Arbitragem nao encontrada');
    }

    const isRequerente = arb.requerenteId === userId;
    const isRequerido = arb.requeridoId === userId;

    if (!isRequerente && !isRequerido) {
      throw new BadRequestException('Voce nao e parte desta arbitragem');
    }

    // 4. Check if user already signed
    if (isRequerente && compromisso.assinReqAt) {
      throw new BadRequestException('Requerente ja assinou este compromisso');
    }
    if (isRequerido && compromisso.assinReqdoAt) {
      throw new BadRequestException('Requerido ja assinou este compromisso');
    }

    // 5. Get user's A1 certificate
    const { pfxBuffer, senha, cn } =
      await this.certificadoService.getCertificadoParaAssinatura(userId);

    // 6. Read current PDF from storage (funciona com supabase, s3 ou local)
    let currentPdfBuffer: Buffer;
    try {
      currentPdfBuffer = await this.storage.getBuffer(compromisso.pdfUrl);
      this.logger.log(
        `[sign compromisso] arb=${arb.numero} currentPdfBuffer=${currentPdfBuffer.length} bytes (lido de ${compromisso.pdfUrl})`,
      );
    } catch (err: any) {
      this.logger.error(`Erro ao baixar PDF do compromisso ${compromisso.id}: ${err.message}`);
      throw new BadRequestException(
        'Arquivo PDF nao acessivel no storage. O compromisso pode precisar ser regerado.',
      );
    }

    // 7. Sign the PDF with user's certificate
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nome: true },
    });
    const signerName = user?.nome || cn || 'Usuario';

    const { signedPdfBuffer, hash } = await this.pdfSignerService.assinarPdf(
      userId,
      currentPdfBuffer,
      {
        arbitragemNumero: arb.numero,
        tipo: 'Compromisso Arbitral',
        signerName,
      },
    );

    this.logger.log(
      `[sign compromisso] arb=${arb.numero} signedPdfBuffer=${signedPdfBuffer.length} bytes, hash=${hash.slice(0, 16)}...`,
    );

    // 8. Re-upload signed PDF (overwrite same key)
    const storageKey = `arbitragens/${arbitragemId}/compromisso/compromisso-${arb.numero}.pdf`;
    const uploaded = await this.storage.upload(signedPdfBuffer, storageKey, 'application/pdf');
    this.logger.log(
      `[sign compromisso] arb=${arb.numero} upload OK key=${storageKey} url=${uploaded.url}`,
    );

    // 9. Update compromisso fields
    const updateData: any = {
      pdfUrl: uploaded.url,
      hashSha256: hash,
    };

    if (isRequerente) {
      updateData.assinReqAt = new Date();
      updateData.assinaturaReqCn = cn;
    }
    if (isRequerido) {
      updateData.assinReqdoAt = new Date();
      updateData.assinaturaReqdoCn = cn;
    }

    const updated = await this.prisma.compromisso.update({
      where: { id: compromisso.id },
      data: updateData,
    });

    // 10. If BOTH signed: update status
    if (updated.assinReqAt && updated.assinReqdoAt) {
      await this.prisma.compromisso.update({
        where: { id: compromisso.id },
        data: { status: 'assinado' },
      });

      await this.prisma.arbitragem.update({
        where: { id: arbitragemId },
        data: { status: 'EM_INSTRUCAO' },
      });

      // Emitir evento de compromisso assinado
      this.events.emitCompromissoAssinado({
        arbitragemId,
        numero: arb.numero,
        requerenteId: arb.requerenteId,
        requeridoId: arb.requeridoId || '',
      });
    }

    // 11. Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'COMPROMISSO_ASSINADO_DIGITALMENTE',
        entidade: 'compromisso',
        entidadeId: compromisso.id,
        dadosDepois: {
          cn,
          hash,
          role: isRequerente ? 'requerente' : 'requerido',
          pdfUrl: uploaded.url,
        },
      },
    });

    // 12. Return
    return {
      success: true,
      cn,
      assinadoEm: new Date().toISOString(),
      role: isRequerente ? 'requerente' : 'requerido',
    };
  }

  /**
   * Logica compartilhada entre assinatura simples e avancada.
   * tipo: 'simples' (aceite direto) ou 'avancada' (validado por OTP + CPF)
   */
  private async executarAssinaturaSimples(
    arbitragemId: string,
    userId: string,
    meta: { ip: string; userAgent: string },
    tipo: 'simples' | 'avancada' = 'simples',
  ) {
    // 1-4: mesmas validacoes do assinarDigital
    const compromisso = await this.prisma.compromisso.findUnique({ where: { arbitragemId } });
    if (!compromisso) throw new NotFoundException('Compromisso nao encontrado');
    if (!compromisso.pdfUrl) throw new BadRequestException('PDF do compromisso ainda nao foi gerado');

    const arb = await this.prisma.arbitragem.findUnique({ where: { id: arbitragemId } });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    const isRequerente = arb.requerenteId === userId;
    const isRequerido = arb.requeridoId === userId;
    if (!isRequerente && !isRequerido) throw new BadRequestException('Voce nao e parte desta arbitragem');
    if (isRequerente && compromisso.assinReqAt) throw new BadRequestException('Requerente ja assinou');
    if (isRequerido && compromisso.assinReqdoAt) throw new BadRequestException('Requerido ja assinou');

    // 5. Buscar dados do user pra pagina visual
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nome: true, cpfCnpj: true, email: true },
    });
    const signerName = user?.nome || 'Usuario';
    const signerLabel = `${signerName} (CPF/CNPJ: ${user?.cpfCnpj || 'N/I'})`;

    // 6. Ler PDF atual do storage
    let currentPdfBuffer: Buffer;
    try {
      currentPdfBuffer = await this.storage.getBuffer(compromisso.pdfUrl);
    } catch (err: any) {
      throw new BadRequestException('Arquivo PDF nao acessivel. O compromisso pode precisar ser regerado.');
    }

    // 7. Adicionar pagina visual de assinatura (sem PKCS7)
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(currentPdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 60;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    let y = pageHeight - margin;
    const docHash = (await import('crypto')).createHash('sha256').update(currentPdfBuffer).digest('hex');
    const dataAssinatura = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Titulo
    page.drawText('DOCUMENTO ASSINADO ELETRONICAMENTE', {
      x: margin, y, size: 16, font: fontBold, color: rgb(0.0, 0.3, 0.15),
    });
    y -= 30;

    // Box de informacoes
    page.drawRectangle({
      x: margin - 5, y: y - 220, width: pageWidth - margin * 2 + 10, height: 250,
      borderColor: rgb(0.0, 0.4, 0.2), borderWidth: 2, color: rgb(0.95, 0.99, 0.95),
    });
    y -= 10;

    const drawInfo = (label: string, value: string) => {
      page.drawText(label, { x: margin + 10, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(value, { x: margin + 160, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    };

    drawInfo('Tipo:', 'Compromisso Arbitral');
    drawInfo('Processo:', arb.numero);
    drawInfo('Assinado por:', signerName);
    drawInfo('CPF/CNPJ:', user?.cpfCnpj || 'N/I');
    drawInfo('Email:', user?.email || 'N/I');
    drawInfo('Metodo:', tipo === 'avancada' ? 'Assinatura Avancada (Email + CPF)' : 'Assinatura Eletronica Simples');
    drawInfo('IP:', meta.ip);
    drawInfo('Data/Hora:', dataAssinatura);
    drawInfo('Hash SHA-256:', docHash.substring(0, 40) + '...');

    y -= 30;

    page.drawText('VALIDADE JURIDICA', {
      x: margin, y, size: 12, font: fontBold, color: rgb(0.1, 0.2, 0.5),
    });
    y -= 20;

    const avisoLines = [
      'Este documento foi assinado eletronicamente de forma simples,',
      'conforme a Lei 14.063/2020, Art. 4 (assinatura eletronica simples).',
      '',
      'Evidencias registradas pela plataforma ArbitraX:',
      '  - Identidade do signatario (CPF/CNPJ + email vinculado a conta)',
      '  - Endereco IP e User-Agent do dispositivo',
      '  - Hash SHA-256 do documento no momento da assinatura',
      '  - Data/hora registrada pelo servidor',
      '',
      'ArbitraX - Plataforma de Arbitragem Digital',
    ];
    for (const line of avisoLines) {
      page.drawText(line, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
    }

    const signedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
    const signedPdfBuffer = Buffer.from(signedPdfBytes);
    const hash = (await import('crypto')).createHash('sha256').update(signedPdfBuffer).digest('hex');

    // 8. Upload PDF assinado
    const storageKey = `arbitragens/${arbitragemId}/compromisso/compromisso-${arb.numero}.pdf`;

    this.logger.log(`[assinar-simples] ${arb.numero}: ${signerName} assinando, PDF=${signedPdfBuffer.length} bytes`);

    const uploaded = await this.storage.upload(signedPdfBuffer, storageKey, 'application/pdf');

    // 9. Atualizar compromisso
    const updateData: any = {
      pdfUrl: uploaded.url,
      hashSha256: hash,
    };

    const cnSimples = tipo === 'avancada'
      ? `Assinatura Avancada (Email) - ${signerLabel}`
      : `Assinatura Simples - ${signerLabel}`;

    if (isRequerente) {
      updateData.assinReqAt = new Date();
      updateData.assinaturaReqCn = cnSimples;
    }
    if (isRequerido) {
      updateData.assinReqdoAt = new Date();
      updateData.assinaturaReqdoCn = cnSimples;
    }

    const updated = await this.prisma.compromisso.update({
      where: { id: compromisso.id },
      data: updateData,
    });

    // 10. Se ambos assinaram
    if (updated.assinReqAt && updated.assinReqdoAt) {
      await this.prisma.compromisso.update({
        where: { id: compromisso.id },
        data: { status: 'assinado' },
      });

      await this.prisma.arbitragem.update({
        where: { id: arbitragemId },
        data: { status: 'EM_INSTRUCAO' },
      });

      this.events.emitCompromissoAssinado({
        arbitragemId,
        numero: arb.numero,
        requerenteId: arb.requerenteId,
        requeridoId: arb.requeridoId || '',
      });
    }

    // 11. Audit log com evidencias completas
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: tipo === 'avancada' ? 'COMPROMISSO_ASSINADO_AVANCADA' : 'COMPROMISSO_ASSINADO_SIMPLES',
        entidade: 'compromisso',
        entidadeId: compromisso.id,
        dadosDepois: {
          metodo: tipo === 'avancada' ? 'email_otp' : 'assinatura_simples',
          signerName,
          cpfCnpj: user?.cpfCnpj,
          email: user?.email,
          ip: meta.ip,
          userAgent: meta.userAgent,
          hash,
          role: isRequerente ? 'requerente' : 'requerido',
          pdfUrl: uploaded.url,
        },
      },
    });

    this.logger.log(`[assinar-simples] ${arb.numero}: assinado por ${signerName} (${meta.ip})`);

    return {
      success: true,
      cn: cnSimples,
      assinadoEm: new Date().toISOString(),
      role: isRequerente ? 'requerente' : 'requerido',
      metodo: 'simples',
    };
  }

  /**
   * Envia OTP por email para assinatura avancada.
   * Valida CPF/CNPJ antes de enviar (prova de identidade).
   */
  async enviarOtpAssinatura(arbitragemId: string, userId: string, cpfDigitado: string) {
    // Validacoes basicas
    const compromisso = await this.prisma.compromisso.findUnique({ where: { arbitragemId } });
    if (!compromisso) throw new NotFoundException('Compromisso nao encontrado');
    if (!compromisso.pdfUrl) throw new BadRequestException('PDF ainda nao foi gerado');

    const arb = await this.prisma.arbitragem.findUnique({ where: { id: arbitragemId } });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    const isRequerente = arb.requerenteId === userId;
    const isRequerido = arb.requeridoId === userId;
    if (!isRequerente && !isRequerido) throw new BadRequestException('Voce nao e parte desta arbitragem');
    if (isRequerente && compromisso.assinReqAt) throw new BadRequestException('Requerente ja assinou');
    if (isRequerido && compromisso.assinReqdoAt) throw new BadRequestException('Requerido ja assinou');

    // Buscar user e validar CPF
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nome: true, cpfCnpj: true, email: true },
    });
    if (!user) throw new BadRequestException('Usuario nao encontrado');

    // Strip formatacao pra comparar: remove pontos, hifens, barras
    const cpfLimpo = cpfDigitado.replace(/\D/g, '');
    const cpfDb = (user.cpfCnpj || '').replace(/\D/g, '');
    if (!cpfLimpo || cpfLimpo !== cpfDb) {
      throw new BadRequestException('CPF/CNPJ nao confere com seu cadastro');
    }

    // Gerar codigo OTP de 6 digitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Salvar no compromisso
    await this.prisma.compromisso.update({
      where: { id: compromisso.id },
      data: {
        otpCode: codigo,
        otpUserId: userId,
        otpExpiresAt: expiresAt,
      },
    });

    // Enviar email com codigo OTP
    await this.enviarEmailOtp(user.email, user.nome, codigo, arb.numero);

    this.logger.log(`[enviar-otp] ${arb.numero}: codigo enviado para ${user.email.replace(/(.{2}).+(@)/, '$1***$2')}`);

    // Retornar email mascarado
    const emailMascarado = user.email.replace(/(.{2}).+(@)/, '$1***$2');
    return {
      enviado: true,
      email: emailMascarado,
      expiraEm: '10 minutos',
    };
  }

  private async enviarEmailOtp(email: string, nome: string, codigo: string, casoNumero: string) {
    // Acessa o EmailService que esta injetado via compromisso.module (nao diretamente)
    // Como o CompromissoService nao tem EmailService injetado, preciso acessar via PrismaModule
    // Solucao pragmatica: usar nodemailer direto com as mesmas configs
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });

    const fromEmail = process.env.SMTP_FROM || 'contato@arbitrax.com.br';

    await transporter.sendMail({
      from: `"ArbitraX" <${fromEmail}>`,
      to: email,
      subject: `Codigo de assinatura - ${casoNumero}`,
      html: `
        <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
          <h2 style="color:#1e3a5f;">Codigo de Assinatura Digital</h2>
          <p>Prezado(a) <strong>${nome}</strong>,</p>
          <p>Voce solicitou assinar o Termo de Compromisso Arbitral do caso <strong>${casoNumero}</strong>.</p>
          <p>Seu codigo de verificacao:</p>
          <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
            <p style="margin:0;font-size:36px;font-weight:bold;font-family:'Courier New',monospace;letter-spacing:8px;color:#166534;">${codigo}</p>
          </div>
          <p style="color:#666;font-size:13px;">Este codigo e valido por <strong>10 minutos</strong>.</p>
          <p style="color:#999;font-size:12px;">Se voce nao solicitou, ignore este email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="color:#aaa;font-size:11px;">ArbitraX - Plataforma de Arbitragem Digital</p>
        </div>
      `,
    });
  }

  /**
   * Assinatura avancada: valida OTP + assina.
   * Chamada depois do enviarOtpAssinatura ter sido feito com sucesso.
   */
  async assinarAvancada(
    arbitragemId: string,
    userId: string,
    codigoDigitado: string,
    meta: { ip: string; userAgent: string },
  ) {
    const compromisso = await this.prisma.compromisso.findUnique({ where: { arbitragemId } });
    if (!compromisso) throw new NotFoundException('Compromisso nao encontrado');

    // Validar OTP
    if (!compromisso.otpCode || !compromisso.otpUserId || !compromisso.otpExpiresAt) {
      throw new BadRequestException('Nenhum codigo OTP foi solicitado. Envie o codigo primeiro.');
    }
    if (compromisso.otpUserId !== userId) {
      throw new BadRequestException('O codigo foi solicitado por outro usuario.');
    }
    if (new Date() > compromisso.otpExpiresAt) {
      throw new BadRequestException('Codigo expirado. Solicite um novo codigo.');
    }
    if (compromisso.otpCode !== codigoDigitado.trim()) {
      throw new BadRequestException('Codigo invalido. Verifique e tente novamente.');
    }

    // Limpar OTP antes de assinar (evita reuso)
    await this.prisma.compromisso.update({
      where: { id: compromisso.id },
      data: { otpCode: null, otpUserId: null, otpExpiresAt: null },
    });

    // Reusar a logica do assinarSimples, mas com metodo 'avancada' e label diferente
    // Vou chamar diretamente passando o metodo
    return this.executarAssinaturaSimples(arbitragemId, userId, meta, 'avancada');
  }

  /** Webhook ZapSign */
  async processarWebhook(body: any) {
    const docToken = body.doc?.token;
    if (!docToken) return;

    const compromisso = await this.prisma.compromisso.findFirst({
      where: { clicksignKey: docToken },
    });
    if (!compromisso) return;

    // Reconsultar para atualizar status
    await this.consultar(compromisso.arbitragemId);
  }

  private gerarHtmlCompromisso(arb: any): string {
    const hoje = new Date();
    const dataStr = `${hoje.getDate()} de ${['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][hoje.getMonth()]} de ${hoje.getFullYear()}`;
    const arbitroNome = arb.arbitros?.[0]?.arbitro?.nome || 'A designar';

    return `
<h1>TERMO DE COMPROMISSO ARBITRAL</h1>

<p>Pelo presente instrumento, as partes abaixo qualificadas:</p>

<p><strong>Parte Requerente:</strong> ${arb.requerente?.nome || '[Nome]'}, CPF/CNPJ: ${arb.requerente?.cpfCnpj || '[CPF/CNPJ]'}</p>
<p><strong>Parte Requerida:</strong> ${arb.requerido?.nome || '[Nome]'}, CPF/CNPJ: ${arb.requerido?.cpfCnpj || '[CPF/CNPJ]'}</p>

<p>Concordam em submeter a controversia identificada como <em>${arb.objeto}</em> ao procedimento de arbitragem digital da plataforma Arbitrax, nos seguintes termos:</p>

<h2>1. Aceitacao da Arbitragem</h2>
<p>As partes aceitam e reconhecem a arbitragem como meio exclusivo de solucao da presente disputa, afastando a jurisdicao estatal, conforme os termos da Lei de Arbitragem (Lei 9.307/96).</p>
<p>As partes concordam que a arbitragem sera realizada de forma totalmente digital, sem audiencias presenciais, por meio da plataforma Arbitrax, com envio de provas por documento, audio e video.</p>

<h2>2. Regras Aplicaveis</h2>
<ul>
<li>Lei aplicavel: Normas juridicas vigentes no Brasil.</li>
<li>Equidade: Podera ser aplicada a criterio do arbitro, caso as partes concordem.</li>
<li>Costumes do setor: Consideracao das praticas comerciais usuais relacionadas a materia objeto da arbitragem.</li>
</ul>

<h2>3. Designacao do Arbitro</h2>
<p>O arbitro sera escolhido pelas partes entre os cadastrados na plataforma, ou sorteado automaticamente pela plataforma.</p>
<p>Arbitro designado: ${arbitroNome}</p>

<h2>4. Procedimento e Prazos</h2>
<ul>
<li>Prazo para adesao: 5 (cinco) dias a partir do recebimento deste compromisso.</li>
<li>Prazo maximo para decisao: 6 (seis) meses, salvo atraso causado pelas partes.</li>
</ul>

<h2>5. Taxas e Custos Administrativos</h2>
<p>As partes estao cientes de que a plataforma Arbitrax pode prever taxas administrativas, conforme o plano de assinatura de cada usuario. Os custos serao informados antes da adesao ao procedimento.</p>

<h2>6. Sentenca Arbitral</h2>
<ul>
<li>A decisao final sera elaborada com o auxilio de inteligencia artificial, sendo editada e validada pelo arbitro designado.</li>
<li>A sentenca arbitral sera final e obrigatoria para as partes, tendo os mesmos efeitos de uma decisao judicial definitiva.</li>
</ul>

<h2>7. Foro de Execucao</h2>
<p>Para execucao da sentenca arbitral, as partes elegem o foro da Comarca competente, com renuncia expressa a qualquer outro.</p>

<p>E, por estarem de pleno acordo, firmam este Termo de Compromisso Arbitral digitalmente.</p>

<p>Data: ${dataStr}</p>
<p>Caso: ${arb.numero} | Valor: R$ ${Number(arb.valorCausa).toLocaleString('pt-BR')}</p>

<p><strong>ARBITRAX - A justica do futuro, hoje!</strong></p>
`.trim();
  }
}
