import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
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
}

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/arbitragens/:arbitragemId/chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Enviar mensagem no chat do caso' })
  send(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: SendMessageDto,
    @Request() req: any,
  ) {
    return this.chatService.sendMessage(arbitragemId, req.user.sub, req.user.role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar mensagens do chat' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMessages(
    @Param('arbitragemId') arbitragemId: string,
    @Query('cursor') cursor: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    return this.chatService.getMessages(
      arbitragemId,
      req.user.sub,
      req.user.role,
      cursor,
      Number(limit) || 50,
    );
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
    return this.chatService.getUnreadCount(req.user.sub);
  }
}
