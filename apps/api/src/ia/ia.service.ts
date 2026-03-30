import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface AnaliseProvasResult {
  suficiente: boolean;
  lacunas: Array<{
    tipo: string;
    descricao: string;
    parteResponsavel: string;
    relevancia: 'alta' | 'media' | 'baixa';
  }>;
  confianca: number;
  resumo: string;
}

export interface SentencaGerada {
  ementa: string;
  relatorio: string;
  fundamentacao: string;
  dispositivo: string;
  custas: { requerente: number; requerido: number };
}

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get('OPENAI_API_KEY', ''),
    });
  }

  async analisarProvas(
    caso: { numero: string; objeto: string; valorCausa: number; categoria: string },
    pecas: Array<{ tipo: string; conteudo?: string }>,
    provas: Array<{ tipo: string; descricao?: string; mimeType?: string }>,
  ): Promise<AnaliseProvasResult> {
    const prompt = `Voce e um assistente juridico especializado em arbitragem brasileira (Lei 9.307/96).

Analise as provas e pecas do caso abaixo e determine se sao SUFICIENTES para proferir sentenca.

CASO:
- Numero: ${caso.numero}
- Objeto: ${caso.objeto}
- Valor: R$ ${caso.valorCausa}
- Categoria: ${caso.categoria}

PECAS PROTOCOLADAS (${pecas.length}):
${pecas.map((p, i) => `${i + 1}. [${p.tipo}] ${p.conteudo?.substring(0, 200) || '(sem texto)'}`).join('\n')}

PROVAS ENVIADAS (${provas.length}):
${provas.map((p, i) => `${i + 1}. [${p.tipo}] ${p.descricao || '(sem descricao)'} (${p.mimeType || 'desconhecido'})`).join('\n')}

Responda EXCLUSIVAMENTE em JSON valido:
{
  "suficiente": true/false,
  "lacunas": [{"tipo": "documento|imagem|testemunho", "descricao": "o que falta", "parteResponsavel": "requerente|requerido", "relevancia": "alta|media|baixa"}],
  "confianca": 0.0 a 1.0,
  "resumo": "resumo em 2-3 frases"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (err) {
      this.logger.error('Erro na analise de provas IA', err);
      return {
        suficiente: false,
        lacunas: [],
        confianca: 0,
        resumo: 'Erro ao analisar provas via IA. Tente novamente.',
      };
    }
  }

  async gerarSentenca(
    caso: { numero: string; objeto: string; valorCausa: number; categoria: string },
    pecas: Array<{ tipo: string; conteudo?: string }>,
    provas: Array<{ tipo: string; descricao?: string }>,
  ): Promise<SentencaGerada> {
    const prompt = `Voce e um arbitro virtual assistente, especializado em arbitragem brasileira conforme Lei 9.307/96.

Gere um PROJETO de sentenca arbitral para o caso abaixo. Este e apenas um PROJETO que sera revisado por um arbitro humano.

CASO:
- Numero: ${caso.numero}
- Objeto: ${caso.objeto}
- Valor da causa: R$ ${caso.valorCausa}
- Categoria: ${caso.categoria}

PECAS:
${pecas.map((p, i) => `${i + 1}. [${p.tipo}] ${p.conteudo?.substring(0, 500) || '(anexo)'}`).join('\n')}

PROVAS:
${provas.map((p, i) => `${i + 1}. [${p.tipo}] ${p.descricao || '(sem descricao)'}`).join('\n')}

REGRAS:
- Aplique Lei 9.307/96, equidade, usos e costumes
- Divida custas 50/50 entre as partes (salvo justificativa)
- Seja imparcial e fundamentado
- Use linguagem juridica formal brasileira

Responda EXCLUSIVAMENTE em JSON valido:
{
  "ementa": "resumo em 1-2 paragrafos",
  "relatorio": "descricao dos fatos e do procedimento",
  "fundamentacao": "analise juridica detalhada",
  "dispositivo": "decisao final com determinacoes",
  "custas": {"requerente": valor_numerico, "requerido": valor_numerico}
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (err) {
      this.logger.error('Erro ao gerar sentenca IA', err);
      throw err;
    }
  }

  async refinarSentenca(
    sentencaAtual: SentencaGerada,
    sugestoes: string,
  ): Promise<SentencaGerada> {
    const prompt = `Voce e um arbitro virtual assistente. Um arbitro humano revisou o projeto de sentenca abaixo e enviou sugestoes de melhoria.

SENTENCA ATUAL:
${JSON.stringify(sentencaAtual, null, 2)}

SUGESTOES DO ARBITRO:
${sugestoes}

Incorpore as sugestoes e gere uma nova versao da sentenca. Mantenha o formato e a fundamentacao juridica.

Responda EXCLUSIVAMENTE em JSON valido:
{
  "ementa": "...",
  "relatorio": "...",
  "fundamentacao": "...",
  "dispositivo": "...",
  "custas": {"requerente": numero, "requerido": numero}
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (err) {
      this.logger.error('Erro ao refinar sentenca IA', err);
      throw err;
    }
  }
}
