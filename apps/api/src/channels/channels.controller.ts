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
import { ChannelsService } from './channels.service.js';
import {
  AddMemberDto,
  CreateChannelDto,
  CreateDmDto,
} from './dto/create-channel.dto.js';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(
    @Inject(ChannelsService) private readonly channels: ChannelsService,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.channels.listForUser(BigInt(req.user.userId));
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateChannelDto) {
    return this.channels.create(BigInt(req.user.userId), dto);
  }

  @Post('dm')
  createDm(@Req() req: AuthedRequest, @Body() dto: CreateDmDto) {
    return this.channels.createDm(BigInt(req.user.userId), dto);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.channels.getById(BigInt(id), BigInt(req.user.userId));
  }

  @Post(':id/join')
  join(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.channels.joinPublic(BigInt(id), BigInt(req.user.userId));
  }

  @Post(':id/members')
  addMember(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.channels.addMember(BigInt(id), BigInt(req.user.userId), dto);
  }
}
