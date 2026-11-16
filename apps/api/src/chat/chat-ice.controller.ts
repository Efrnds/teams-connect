import { Controller, Get, Headers } from '@nestjs/common';
import { ChatIceService } from './chat-ice.service.js';

@Controller('chat')
export class ChatIceController {
  constructor(private readonly ice: ChatIceService) {}

  @Get('ice-servers')
  iceServers(@Headers('authorization') authorization?: string) {
    return this.ice.getIceServersForToken(authorization);
  }
}