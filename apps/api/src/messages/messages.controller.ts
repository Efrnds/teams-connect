import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ChatGateway } from '../chat/chat.gateway.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { MessagesService } from './messages.service.js';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('channels/:channelId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    @Inject(MessagesService) private readonly messages: MessagesService,
    @Inject(ChatGateway) private readonly chat: ChatGateway,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest, @Param('channelId') channelId: string) {
    return this.messages.list(BigInt(channelId), BigInt(req.user.userId));
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Param('channelId') channelId: string,
    @Body() dto: CreateMessageDto,
  ) {
    const message = await this.messages.create(
      BigInt(channelId),
      BigInt(req.user.userId),
      dto,
    );
    this.chat.emitMessage(channelId, message);
    return message;
  }
}
