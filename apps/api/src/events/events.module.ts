import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventsService } from './events.service';
import { EventsListener } from './events.listener';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [EventsService, EventsListener],
  exports: [EventsService],
})
export class EventsModule {}
