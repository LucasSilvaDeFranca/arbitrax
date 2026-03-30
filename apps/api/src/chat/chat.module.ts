import { Module } from '@nestjs/common';
import { ChatController, ChatUnreadController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController, ChatUnreadController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
