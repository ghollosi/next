import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiChatService, ChatContext, ChatMessage, UserRole } from './ai-chat.service';
import { SessionService, DriverSessionData, OperatorSessionData, PartnerSessionData } from '../common/session/session.service';
import { SessionType } from '@prisma/client';

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

  constructor(
    private readonly aiChatService: AiChatService,
    private readonly sessionService: SessionService,
  ) {}

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

    // Try quick response first
    const quickResponse = this.aiChatService.getQuickResponse(body.message, language);
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
  @ApiHeader({ name: 'x-driver-session', required: false, description: 'Driver session ID' })
  @ApiHeader({ name: 'x-operator-session', required: false, description: 'Operator session ID' })
  @ApiHeader({ name: 'x-partner-session', required: false, description: 'Partner session ID' })
  @ApiHeader({ name: 'X-User-Role', required: true, description: 'User role: driver, operator, partner_admin, network_admin, platform_admin' })
  async authenticatedChat(
    @Body() body: ChatRequestDto,
    @Headers('x-user-role') userRole: string,
    @Headers('x-driver-session') driverSessionId?: string,
    @Headers('x-operator-session') operatorSessionId?: string,
    @Headers('x-partner-session') partnerSessionId?: string,
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

    // SECURITY: Verify session based on claimed role
    let networkId: string | undefined;
    let userId: string | undefined;
    let partnerId: string | undefined;
    let locationId: string | undefined;

    if (userRole === 'driver') {
      if (!driverSessionId) {
        throw new UnauthorizedException('Driver session required');
      }
      const session = await this.sessionService.getSession<DriverSessionData>(driverSessionId, SessionType.DRIVER);
      if (!session) {
        throw new UnauthorizedException('Invalid or expired session');
      }
      networkId = session.networkId;
      userId = session.driverId;
      partnerId = session.partnerCompanyId;
    } else if (userRole === 'operator') {
      if (!operatorSessionId) {
        throw new UnauthorizedException('Operator session required');
      }
      const session = await this.sessionService.getSession<OperatorSessionData>(operatorSessionId, SessionType.OPERATOR);
      if (!session) {
        throw new UnauthorizedException('Invalid or expired session');
      }
      networkId = session.networkId;
      locationId = session.locationId;
      userId = session.operatorId || undefined;
    } else if (userRole === 'partner_admin') {
      if (!partnerSessionId) {
        throw new UnauthorizedException('Partner session required');
      }
      const session = await this.sessionService.getSession<PartnerSessionData>(partnerSessionId, SessionType.PARTNER);
      if (!session) {
        throw new UnauthorizedException('Invalid or expired session');
      }
      networkId = session.networkId;
      partnerId = session.partnerId;
      userId = session.partnerId;
    } else {
      // network_admin and platform_admin use JWT-based auth - for now, restrict to session-based roles only
      // These roles should not have access to dynamic context via this endpoint without proper JWT validation
      throw new UnauthorizedException('This role requires JWT authentication which is not supported on this endpoint. Use the portal-specific endpoints instead.');
    }

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
