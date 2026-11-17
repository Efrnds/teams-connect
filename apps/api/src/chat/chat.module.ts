import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChannelsModule } from '../channels/channels.module.js';
import { UsersModule } from '../users/users.module.js';
import { ChatGateway } from './chat.gateway.js';
import { CallSessionStore } from './call-session.store.js';
import { ChatIceController } from './chat-ice.controller.js';
import { ChatIceService } from './chat-ice.service.js';
import { CallKnownUsersRegistry } from './call-known-users.registry.js';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => ChannelsModule), UsersModule],
  controllers: [ChatIceController],
  providers: [ChatGateway, CallSessionStore, ChatIceService, CallKnownUsersRegistry],
  exports: [ChatGateway],
})
export class ChatModule {}
