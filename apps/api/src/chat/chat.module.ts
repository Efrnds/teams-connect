import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChannelsModule } from '../channels/channels.module.js';
import { ChatGateway } from './chat.gateway.js';
import { CallSessionStore } from './call-session.store.js';
import { ChatIceController } from './chat-ice.controller.js';
import { ChatIceService } from './chat-ice.service.js';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => ChannelsModule)],
  controllers: [ChatIceController],
  providers: [ChatGateway, CallSessionStore, ChatIceService],
  exports: [ChatGateway],
})
export class ChatModule {}
