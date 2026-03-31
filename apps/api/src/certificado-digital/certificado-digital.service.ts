import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encryptAes256Gcm, decryptAes256Gcm } from '../common/utils/crypto.util';
import * as forge from 'node-forge';

interface CertificadoMetadata {
  cn: string;
  emissor: string;
  serial: string;
  validade: Date;
}

@Injectable()
export class CertificadoDigitalService {
  private readonly logger = new Logger(CertificadoDigitalService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private getEncryptionKey(): string {
    const key = this.config.get<string>('INTEGRATION_ENCRYPTION_KEY');
    if (!key) {
      throw new BadRequestException(
        'INTEGRATION_ENCRYPTION_KEY nao configurada no servidor',
      );
    }
    return key;
  }

  /** Upload e validação de certificado A1 (.pfx/.p12) */
  async uploadCertificado(
    userId: string,
    file: Express.Multer.File,
    senha: string,
  ) {
    // Validar extensão
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (!['pfx', 'p12'].includes(ext || '')) {
      throw new BadRequestException('Arquivo deve ser .pfx ou .p12');
    }

    // Validar tamanho (max 50KB para A1)
    if (file.size > 50 * 1024) {
      throw new BadRequestException('Arquivo muito grande. Certificados A1 geralmente tem menos de 50KB');
    }

    // Extrair e validar certificado
    const metadata = this.extrairCertificado(file.buffer, senha);

    // Verificar validade
    if (metadata.validade < new Date()) {
      throw new BadRequestException(
        `Certificado expirado em ${metadata.validade.toLocaleDateString('pt-BR')}`,
      );
    }

    // Criptografar senha e converter PFX para base64
    const pfxBase64 = file.buffer.toString('base64');
    const senhaCriptografada = encryptAes256Gcm(senha, this.getEncryptionKey());

    // Salvar no banco
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        certificadoA1Base64: pfxBase64,
        certificadoA1Senha: senhaCriptografada,
        certificadoA1Cn: metadata.cn,
        certificadoA1Emissor: metadata.emissor,
        certificadoA1Validade: metadata.validade,
        certificadoA1Serial: metadata.serial,
        certificadoA1AtualizadoEm: new Date(),
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'CERTIFICADO_A1_UPLOAD',
        entidade: 'user',
        entidadeId: userId,
        dadosDepois: {
          cn: metadata.cn,
          emissor: metadata.emissor,
          validade: metadata.validade.toISOString(),
          serial: metadata.serial,
        },
      },
    });

    this.logger.log(`Certificado A1 configurado para usuario ${userId}: ${metadata.cn}`);

    return {
      cn: metadata.cn,
      emissor: metadata.emissor,
      validade: metadata.validade.toISOString(),
      serial: metadata.serial,
      message: 'Certificado A1 configurado com sucesso',
    };
  }

  /** Consultar status do certificado */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        certificadoA1Cn: true,
        certificadoA1Emissor: true,
        certificadoA1Validade: true,
        certificadoA1Serial: true,
        certificadoA1AtualizadoEm: true,
      },
    });

    if (!user) throw new NotFoundException('Usuario nao encontrado');

    const temCertificado = !!user.certificadoA1Cn;
    let expirado = false;
    let diasRestantes: number | null = null;

    if (temCertificado && user.certificadoA1Validade) {
      const agora = new Date();
      expirado = user.certificadoA1Validade < agora;
      diasRestantes = Math.ceil(
        (user.certificadoA1Validade.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    return {
      temCertificado,
      cn: user.certificadoA1Cn,
      emissor: user.certificadoA1Emissor,
      validade: user.certificadoA1Validade?.toISOString() || null,
      serial: user.certificadoA1Serial,
      atualizadoEm: user.certificadoA1AtualizadoEm?.toISOString() || null,
      expirado,
      diasRestantes,
    };
  }

  /** Remover certificado */
  async removeCertificado(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { certificadoA1Cn: true },
    });

    if (!user?.certificadoA1Cn) {
      throw new BadRequestException('Nenhum certificado configurado');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        certificadoA1Base64: null,
        certificadoA1Senha: null,
        certificadoA1Cn: null,
        certificadoA1Emissor: null,
        certificadoA1Validade: null,
        certificadoA1Serial: null,
        certificadoA1AtualizadoEm: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'CERTIFICADO_A1_REMOVIDO',
        entidade: 'user',
        entidadeId: userId,
        dadosAntes: { cn: user.certificadoA1Cn },
      },
    });

    return { message: 'Certificado removido com sucesso' };
  }

  /** Re-validar certificado armazenado */
  async validar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        certificadoA1Base64: true,
        certificadoA1Senha: true,
        certificadoA1Validade: true,
        certificadoA1Cn: true,
      },
    });

    if (!user?.certificadoA1Base64 || !user?.certificadoA1Senha) {
      throw new BadRequestException('Nenhum certificado configurado');
    }

    try {
      const senha = decryptAes256Gcm(user.certificadoA1Senha, this.getEncryptionKey());
      const pfxBuffer = Buffer.from(user.certificadoA1Base64, 'base64');
      const metadata = this.extrairCertificado(pfxBuffer, senha);

      const expirado = metadata.validade < new Date();

      return {
        valido: !expirado,
        cn: metadata.cn,
        emissor: metadata.emissor,
        validade: metadata.validade.toISOString(),
        expirado,
        message: expirado
          ? 'Certificado expirado. Faca upload de um novo certificado.'
          : 'Certificado valido e pronto para uso.',
      };
    } catch (err) {
      this.logger.error(`Erro ao validar certificado do usuario ${userId}`, err);
      throw new BadRequestException(
        'Certificado armazenado esta corrompido ou a chave de criptografia mudou. Faca upload novamente.',
      );
    }
  }

  /** Recuperar material do certificado para assinatura (uso interno) */
  async getCertificadoParaAssinatura(userId: string): Promise<{
    pfxBuffer: Buffer;
    senha: string;
    cn: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        certificadoA1Base64: true,
        certificadoA1Senha: true,
        certificadoA1Validade: true,
        certificadoA1Cn: true,
      },
    });

    if (!user?.certificadoA1Base64 || !user?.certificadoA1Senha) {
      throw new BadRequestException(
        'Nenhum certificado A1 configurado. Configure em Certificado Digital.',
      );
    }

    if (user.certificadoA1Validade && user.certificadoA1Validade < new Date()) {
      throw new BadRequestException('Certificado A1 expirado. Faca upload de um novo certificado.');
    }

    const senha = decryptAes256Gcm(user.certificadoA1Senha, this.getEncryptionKey());
    const pfxBuffer = Buffer.from(user.certificadoA1Base64, 'base64');

    return { pfxBuffer, senha, cn: user.certificadoA1Cn || '' };
  }

  /** Extrair metadados do certificado a partir do PFX */
  private extrairCertificado(pfxBuffer: Buffer, senha: string): CertificadoMetadata {
    try {
      const derBuffer = forge.util.createBuffer(pfxBuffer.toString('binary'));
      const asn1 = forge.asn1.fromDer(derBuffer);
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);

      // Extrair certificados
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certs = certBags[forge.pki.oids.certBag];
      if (!certs || certs.length === 0) {
        throw new Error('Nenhum certificado encontrado no arquivo PFX');
      }

      const cert = certs[0].cert;
      if (!cert) {
        throw new Error('Certificado invalido no arquivo PFX');
      }

      // Extrair chave privada (obrigatória para assinar)
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keys = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
      if (!keys || keys.length === 0) {
        throw new Error('Chave privada nao encontrada no arquivo PFX. Necessaria para assinatura digital.');
      }

      const cnField = cert.subject.getField('CN');
      const emissorField = cert.issuer.getField('CN');

      return {
        cn: cnField?.value || 'CN nao disponivel',
        emissor: emissorField?.value || 'Emissor nao disponivel',
        serial: cert.serialNumber || '',
        validade: cert.validity.notAfter,
      };
    } catch (err: any) {
      if (err.message?.includes('Invalid password') || err.message?.includes('PKCS#12')) {
        throw new BadRequestException('Senha incorreta para o certificado PFX');
      }
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Erro ao ler certificado: ${err.message || 'Arquivo PFX invalido'}`,
      );
    }
  }
}
