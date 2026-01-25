import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SessionModule } from '../common/session/session.module';
import { AuthModule } from '../common/auth/auth.module';

@Module({
  imports: [ConfigModule, PrismaModule, SessionModule, AuthModule],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
