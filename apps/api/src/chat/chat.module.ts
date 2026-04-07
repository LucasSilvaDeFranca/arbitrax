import { Module } from '@nestjs/common';
import { ChatController, ChatUnreadController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatIaService } from './chat-ia.service';

@Module({
  controllers: [ChatController, ChatUnreadController],
  providers: [ChatService, ChatIaService],
  exports: [ChatService],
})
export class ChatModule {}
