import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiChatService, ChatContext, ChatMessage, UserRole } from './ai-chat.service';

// DTO for chat request
interface ChatRequestDto {
  message: string;
  conversationHistory?: ChatMessage[];
  language?: 'hu' | 'en';
}

// DTO for chat response
interface ChatResponseDto {
  message: string;
  isQuickResponse: boolean;
}

@ApiTags('ai-chat')
@Controller('ai-chat')
export class AiChatController {
  private readonly logger = new Logger(AiChatController.name);

  constructor(private readonly aiChatService: AiChatService) {}

  // Public chat endpoint for landing page (guests)
  @Post('public')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute for guests
  @ApiOperation({ summary: 'Public chat for landing page visitors' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Mi az a vSys Wash?' },
        conversationHistory: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' },
            },
          },
        },
        language: { type: 'string', enum: ['hu', 'en'], default: 'hu' },
      },
      required: ['message'],
    },
  })
  async publicChat(@Body() body: ChatRequestDto): Promise<ChatResponseDto> {
    if (!body.message || body.message.trim().length === 0) {
      throw new BadRequestException('Message is required');
    }

    if (body.message.length > 500) {
      throw new BadRequestException('Message too long (max 500 characters)');
    }

    const language = body.language || 'hu';

    // Try quick response first (only for guests)
    const quickResponse = this.aiChatService.getQuickResponse(body.message, language, 'guest');
    if (quickResponse) {
      return {
        message: quickResponse,
        isQuickResponse: true,
      };
    }

    // Use AI for more complex questions
    const context: ChatContext = {
      role: 'guest',
      language,
    };

    const response = await this.aiChatService.chat(
      body.message,
      context,
      body.conversationHistory || [],
    );

    return {
      message: response,
      isQuickResponse: false,
    };
  }

  // Authenticated chat endpoint for logged-in users
  @Post('authenticated')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 requests per minute for logged-in users
  @ApiOperation({ summary: 'Authenticated chat for logged-in users' })
  @ApiHeader({ name: 'Authorization', required: true })
  @ApiHeader({ name: 'X-User-Role', required: true, description: 'User role: driver, operator, partner_admin, network_admin, platform_admin' })
  @ApiHeader({ name: 'X-Network-ID', required: false })
  @ApiHeader({ name: 'X-Partner-ID', required: false })
  @ApiHeader({ name: 'X-Location-ID', required: false })
  @ApiHeader({ name: 'X-User-ID', required: false })
  async authenticatedChat(
    @Body() body: ChatRequestDto,
    @Headers('x-user-role') userRole: string,
    @Headers('x-network-id') networkId?: string,
    @Headers('x-partner-id') partnerId?: string,
    @Headers('x-location-id') locationId?: string,
    @Headers('x-user-id') userId?: string,
  ): Promise<ChatResponseDto> {
    if (!body.message || body.message.trim().length === 0) {
      throw new BadRequestException('Message is required');
    }

    if (body.message.length > 1000) {
      throw new BadRequestException('Message too long (max 1000 characters)');
    }

    // Validate role
    const validRoles: UserRole[] = ['driver', 'operator', 'partner_admin', 'network_admin', 'platform_admin'];
    if (!validRoles.includes(userRole as UserRole)) {
      throw new BadRequestException('Invalid user role');
    }

    const language = body.language || 'hu';

    // Skip quick responses for authenticated users - they should always get contextual AI answers
    // The getQuickResponse now returns null for non-guest roles anyway

    const context: ChatContext = {
      role: userRole as UserRole,
      userId,
      networkId,
      partnerId,
      locationId,
      language,
    };

    const response = await this.aiChatService.chat(
      body.message,
      context,
      body.conversationHistory || [],
    );

    return {
      message: response,
      isQuickResponse: false,
    };
  }

  // Health check for AI service
  @Post('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check AI chat service status' })
  async getStatus(): Promise<{ available: boolean; message: string }> {
    const available = this.aiChatService.isAvailable();
    return {
      available,
      message: available
        ? 'AI chat service is operational'
        : 'AI chat service is not configured (missing API key)',
    };
  }
}
