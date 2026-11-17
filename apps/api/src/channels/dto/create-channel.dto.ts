import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from '../../generated/prisma/enums.js';

export class CreateChannelDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** PUBLIC (padrão) ou PRIVATE. DM só via /channels/dm */
  @IsOptional()
  @IsEnum(Type)
  type?: (typeof Type)[keyof typeof Type];

  /** IDs de users convidados (obrigatório ter sentido em PRIVATE) */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  memberIds?: string[];
}

export class CreateDmDto {
  @IsString()
  otherUserId!: string;
}

export class AddMemberDto {
  @IsString()
  userId!: string;
}
