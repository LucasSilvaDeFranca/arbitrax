import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import OpenAI from 'openai';

@Injectable()
export class ChatIaService {
  private readonly logger = new Logger(ChatIaService.name);
  private openai: OpenAI;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private ragService: RagService,
  ) {
    this.openai = new OpenAI({ apiKey: this.config.get('OPENAI_API_KEY', '') });
  }

  async responderPergunta(arbitragemId: string, canal: string, pergunta: string): Promise<string> {
    // 1. Load case context
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      select: {
        numero: true, objeto: true, status: true, valorCausa: true, categoria: true,
        requerente: { select: { nome: true } },
        requerido: { select: { nome: true } },
        prazos: { where: { status: 'ATIVO' }, select: { tipo: true, fim: true }, take: 5 },
        _count: { select: { pecas: true, provas: true } },
      },
    });

    if (!arb) return 'Caso nao encontrado.';

    // 2. Load recent chat history (last 10 msgs from this channel)
    const recentMsgs = await this.prisma.chatMessage.findMany({
      where: { arbitragemId, canal },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { tipo: true, conteudo: true, user: { select: { nome: true, role: true } } },
    });

    const historico = recentMsgs.reverse().map(m => {
      if (m.tipo === 'ia') return `Assistente: ${m.conteudo}`;
      return `${m.user?.nome || 'Usuario'} (${m.user?.role || ''}): ${m.conteudo}`;
    }).join('\n');

    // 3. RAG context
    let contextoRag = '';
    try {
      const chunks = await this.ragService.buscarContexto(arbitragemId, pergunta, 8);
      if (chunks.length > 0) {
        contextoRag = '\n\nDOCUMENTOS RELEVANTES:\n' +
          chunks.map(c => `[${c.metadata?.parteRole || 'Parte'}] ${c.content}`).join('\n\n');
      }
    } catch {}

    // 4. Build system prompt based on canal
    const prazosInfo = arb.prazos.map(p => `${p.tipo}: vence em ${new Date(p.fim).toLocaleDateString('pt-BR')}`).join(', ');

    let systemPrompt: string;
    if (canal === 'arbitragem') {
      systemPrompt = `Voce e um analista juridico assistente do arbitro na plataforma ArbitraX.
Forneca analise aprofundada das provas, sugira fundamentacao juridica (Lei 9.307/96, Codigo Civil, jurisprudencia).
Discuta pontos criticos, identifique fortalezas e fraquezas dos argumentos de cada parte.
Seja detalhado e tecnico. Use linguagem juridica formal.

CASO: ${arb.numero} | ${arb.objeto}
Valor: R$ ${Number(arb.valorCausa).toLocaleString('pt-BR')} | Categoria: ${arb.categoria}
Status: ${arb.status}
Requerente: ${arb.requerente?.nome} | Requerido: ${arb.requerido?.nome}
Pecas: ${arb._count.pecas} | Provas: ${arb._count.provas}
${prazosInfo ? `Prazos ativos: ${prazosInfo}` : 'Sem prazos ativos'}
${contextoRag}`;
    } else {
      systemPrompt = `Voce e um assistente da plataforma ArbitraX que orienta as partes sobre o procedimento arbitral.
Responda de forma clara, educada e acessivel.
Oriente sobre: status do caso, prazos, documentos necessarios, proximos passos.
NUNCA revele analises internas, estrategias do arbitro, ou conteudo de sentencas em andamento.
NUNCA tome partido - seja imparcial.

CASO: ${arb.numero} | ${arb.objeto}
Valor: R$ ${Number(arb.valorCausa).toLocaleString('pt-BR')} | Categoria: ${arb.categoria}
Status: ${arb.status}
Requerente: ${arb.requerente?.nome} | Requerido: ${arb.requerido?.nome}
Pecas protocoladas: ${arb._count.pecas} | Provas enviadas: ${arb._count.provas}
${prazosInfo ? `Prazos ativos: ${prazosInfo}` : 'Sem prazos ativos'}
${contextoRag}`;
    }

    // 5. Call OpenAI
    try {
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (historico) {
        messages.push({ role: 'user', content: `Historico recente do chat:\n${historico}` });
      }

      messages.push({ role: 'user', content: pergunta });

      const response = await this.openai.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o'),
        messages,
        temperature: canal === 'arbitragem' ? 0.4 : 0.3,
        max_tokens: canal === 'arbitragem' ? 2000 : 1000,
      });

      return response.choices[0]?.message?.content || 'Nao foi possivel gerar resposta.';
    } catch (err: any) {
      this.logger.error(`Erro IA chat: ${err.message}`);
      return 'Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.';
    }
  }
}
