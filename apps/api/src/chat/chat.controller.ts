import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatIaService } from './chat-ia.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SendMessageDto {
  @ApiProperty({ example: 'Segue o contrato assinado em anexo.' })
  @IsOptional()
  @IsString()
  conteudo?: string;

  @ApiPropertyOptional({ example: 'text' })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({ example: 'processo', description: "Canal do chat: 'processo' (grupo publico) ou 'sentenca' (grupo privado arbitro+IA)" })
  @IsOptional()
  @IsString()
  canal?: string;
}

class EncaminharDto {
  @ApiProperty({ description: 'ID da mensagem do chat de sentenca a ser encaminhada' })
  @IsString()
  messageId: string;

  @ApiPropertyOptional({ description: 'Texto editado pelo arbitro antes de enviar ao Chat 1' })
  @IsOptional()
  @IsString()
  textoEditado?: string;
}

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/arbitragens/:arbitragemId/chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatIaService: ChatIaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Enviar mensagem no chat do caso' })
  send(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: SendMessageDto,
    @Request() req: any,
  ) {
    return this.chatService.sendMessage(arbitragemId, req.user.sub, req.user.role, {
      conteudo: dto.conteudo,
      tipo: dto.tipo,
      mediaUrl: dto.mediaUrl,
      canal: dto.canal,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar mensagens do chat' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'canal', required: false, description: "'processo' (grupo publico) ou 'sentenca' (privado arbitro+IA)" })
  getMessages(
    @Param('arbitragemId') arbitragemId: string,
    @Query('cursor') cursor: string,
    @Query('limit') limit: string,
    @Query('canal') canal: string,
    @Request() req: any,
  ) {
    return this.chatService.getMessages(
      arbitragemId,
      req.user.sub,
      req.user.role,
      canal || 'processo',
      cursor,
      Number(limit) || 50,
    );
  }

  @Post('encaminhar')
  @ApiOperation({
    summary: 'Encaminha pergunta do Chat 2 (sentenca) como pergunta oficial no Chat 1 (processo)',
    description: 'Uso pelo arbitro: quando a IA levanta uma duvida no chat de sentenca, o arbitro seleciona a mensagem, edita se quiser, e encaminha como pergunta oficial para as partes responderem no chat do processo.',
  })
  encaminhar(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: EncaminharDto,
    @Request() req: any,
  ) {
    return this.chatService.encaminharParaProcesso(
      arbitragemId,
      req.user.sub,
      req.user.role,
      { messageId: dto.messageId, textoEditado: dto.textoEditado },
    );
  }

  @Post('ia')
  @ApiOperation({
    summary: 'Arbitro conversa com a IA no chat de sentenca (Chat 2)',
    description: 'So arbitros tem acesso. A IA analisa provas e pecas, ajuda a construir a sentenca. Se tiver duvida sobre algo, pode pedir esclarecimento e o arbitro pode usar POST /encaminhar para levar a pergunta ao Chat 1.',
  })
  async askIa(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: { pergunta: string; canal?: string },
    @Request() req: any,
  ) {
    // Validate pergunta
    if (!dto.pergunta || dto.pergunta.trim().length === 0) {
      throw new BadRequestException('Pergunta obrigatoria');
    }
    if (dto.pergunta.length > 2000) {
      throw new BadRequestException('Pergunta muito longa (max 2000 caracteres)');
    }

    // Chat com IA so existe no canal 'sentenca' agora.
    // Aceitamos 'arbitragem' (legado) e forcamos 'sentenca'.
    const canalRaw = dto.canal || 'sentenca';
    const canal = canalRaw === 'arbitragem' || canalRaw === 'privado' ? 'sentenca' : canalRaw;

    if (canal !== 'sentenca') {
      throw new BadRequestException("IA so responde no canal 'sentenca'");
    }

    // Only arbitros can talk to IA (checkCanalAccess valida no sendMessage)
    if (req.user.role !== 'ARBITRO' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Somente arbitros podem conversar com a IA (chat de sentenca)');
    }

    // Save user question
    await this.chatService.sendMessage(arbitragemId, req.user.sub, req.user.role, {
      conteudo: dto.pergunta,
      canal,
    });

    // Get IA response
    const resposta = await this.chatIaService.responderPergunta(arbitragemId, canal, dto.pergunta, req.user.sub);

    // Save IA response
    const iaMsg = await this.chatService.sendIaMessage(arbitragemId, resposta, canal, req.user.sub);

    return iaMsg;
  }
}

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/chat')
export class ChatUnreadController {
  constructor(private chatService: ChatService) {}

  @Get('unread')
  @ApiOperation({ summary: 'Contar mensagens nao lidas' })
  getUnread(@Request() req: any) {
    return this.chatService.getUnreadCount(req.user.sub, req.user.role);
  }
}
