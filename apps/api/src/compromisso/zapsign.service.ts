import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface CriarDocumentoParams {
  nome: string;
  htmlContent: string;
  signatarios: Array<{
    nome: string;
    email: string;
    cpf?: string;
  }>;
}

interface ZapSignDocumento {
  token: string;
  status: string;
  name: string;
  signers: Array<{
    token: string;
    name: string;
    email: string;
    sign_url: string;
    status: string;
  }>;
}

@Injectable()
export class ZapSignService {
  private readonly logger = new Logger(ZapSignService.name);
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(private config: ConfigService) {
    const env = this.config.get('ZAPSIGN_ENV', 'sandbox');
    this.baseUrl =
      env === 'production'
        ? 'https://api.zapsign.com.br/api/v1'
        : 'https://sandbox.api.zapsign.com.br/api/v1';
    this.apiToken = this.config.get('ZAPSIGN_API_TOKEN', '');
  }

  /** Criar documento para assinatura via ZapSign */
  async criarDocumento(params: CriarDocumentoParams): Promise<ZapSignDocumento | null> {
    if (!this.apiToken) {
      this.logger.warn('ZAPSIGN_API_TOKEN nao configurado. Documento criado sem assinatura digital.');
      return null;
    }

    try {
      // 1. Criar documento
      const docResponse = await axios.post(
        `${this.baseUrl}/docs/`,
        {
          name: params.nome,
          url_pdf: '', // vazio quando usando HTML
          lang: 'pt-br',
          disable_signer_emails: false,
          brand_primary_color: '#1d4ed8',
          signers: params.signatarios.map((s) => ({
            name: s.nome,
            email: s.email,
            auth_mode: 'assinaturaTela',
            send_automatic_email: true,
            lock_name: true,
            lock_email: true,
          })),
        },
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        },
      );

      return docResponse.data;
    } catch (err: any) {
      this.logger.error('Erro ao criar documento ZapSign', err.response?.data || err.message);
      return null;
    }
  }

  /** Consultar status do documento */
  async consultarDocumento(docToken: string): Promise<ZapSignDocumento | null> {
    if (!this.apiToken) return null;

    try {
      const response = await axios.get(`${this.baseUrl}/docs/${docToken}/`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      return response.data;
    } catch (err: any) {
      this.logger.error('Erro ao consultar documento ZapSign', err.response?.data || err.message);
      return null;
    }
  }
}
