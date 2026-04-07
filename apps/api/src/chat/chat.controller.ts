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

  @ApiPropertyOptional({ example: 'processos' })
  @IsOptional()
  @IsString()
  canal?: string;
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
  @ApiQuery({ name: 'canal', required: false })
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
      canal || 'processos',
      cursor,
      Number(limit) || 50,
    );
  }

  @Post('ia')
  @ApiOperation({ summary: 'Perguntar para a IA no chat' })
  async askIa(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: { pergunta: string; canal?: string },
    @Request() req: any,
  ) {
    const canal = dto.canal || 'processos';

    // Access check
    if (canal === 'arbitragem' && req.user.role !== 'ARBITRO' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Acesso restrito');
    }

    // Save user question
    await this.chatService.sendMessage(arbitragemId, req.user.sub, req.user.role, {
      conteudo: dto.pergunta,
      canal,
    });

    // Get IA response
    const resposta = await this.chatIaService.responderPergunta(arbitragemId, canal, dto.pergunta);

    // Save IA response
    const iaMsg = await this.chatService.sendIaMessage(arbitragemId, resposta, canal);

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
