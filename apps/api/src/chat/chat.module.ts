import { Global, Module } from '@nestjs/common';
import { ChatController, ChatUnreadController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatIaService } from './chat-ia.service';

// Global para o EventsListener poder usar ChatService/ChatIaService sem import circular
@Global()
@Module({
  controllers: [ChatController, ChatUnreadController],
  providers: [ChatService, ChatIaService],
  exports: [ChatService, ChatIaService],
})
export class ChatModule {}
