import { Module, forwardRef } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [ChannelsModule, forwardRef(() => ChatModule)],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
