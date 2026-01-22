import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { IsString, IsEmail, IsOptional, IsNumber, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TestPortalService } from './test-portal.service';
import { TesterLanguage } from '@prisma/client';

// DTOs
class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

class TesterLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

class CreateTesterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(['HU', 'EN'])
  language: 'HU' | 'EN';
}

class UpdateTesterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(['HU', 'EN'])
  language?: 'HU' | 'EN';

  @IsOptional()
  @IsEnum(['INVITED', 'ACTIVE', 'COMPLETED', 'EXPIRED'])
  status?: 'INVITED' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

  @IsOptional()
  @IsNumber()
  currentPhase?: number;
}

class SaveFeedbackDto {
  @IsString()
  testerId: string;

  @IsNumber()
  phaseId: number;

  @IsString()
  questionId: string;

  value: string | number | boolean;

  @IsOptional()
  @IsString()
  screenshotUrl?: string;
}

class FeedbackAnswerDto {
  @IsString()
  questionId: string;

  value: string | number | boolean;
}

class SaveBatchFeedbackDto {
  @IsString()
  testerId: string;

  @IsNumber()
  phaseId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeedbackAnswerDto)
  answers: FeedbackAnswerDto[];
}

class CreateBugReportDto {
  @IsString()
  testerId: string;

  @IsNumber()
  phaseId: number;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsString()
  screenshotUrl?: string;
}

class UpdateBugStatusDto {
  @IsEnum(['NEW', 'IN_PROGRESS', 'FIXED', 'WONT_FIX'])
  status: 'NEW' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX';
}

@Controller('test-portal')
export class TestPortalController {
  constructor(private readonly testPortalService: TestPortalService) {}

  // ============= ADMIN =============

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() dto: AdminLoginDto) {
    const valid = this.testPortalService.validateAdminLogin(dto.email, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { success: true, message: 'Admin logged in' };
  }

  // ============= TESTERS =============

  @Get('testers')
  async getTesters() {
    const testers = await this.testPortalService.getTesters();
    // Hide passwords in response
    return testers.map(t => ({ ...t, password: undefined }));
  }

  @Get('testers/:id')
  async getTester(@Param('id') id: string) {
    const tester = await this.testPortalService.getTesterById(id);
    return { ...tester, password: undefined };
  }

  @Post('testers')
  async createTester(@Body() dto: CreateTesterDto) {
    const tester = await this.testPortalService.createTester(
      dto.name,
      dto.email,
      dto.language as TesterLanguage,
    );
    return tester;
  }

  @Put('testers/:id')
  async updateTester(@Param('id') id: string, @Body() dto: UpdateTesterDto) {
    const tester = await this.testPortalService.updateTester(id, dto as any);
    return { ...tester, password: undefined };
  }

  @Delete('testers/:id')
  async deleteTester(@Param('id') id: string) {
    await this.testPortalService.deleteTester(id);
    return { success: true };
  }

  @Post('testers/:id/regenerate-password')
  async regeneratePassword(@Param('id') id: string) {
    const newPassword = await this.testPortalService.regeneratePassword(id);
    return { password: newPassword };
  }

  @Post('testers/:id/send-invite')
  async sendInvite(@Param('id') id: string) {
    return this.testPortalService.sendInviteEmail(id);
  }

  @Post('testers/:id/complete')
  async markCompleted(@Param('id') id: string) {
    const tester = await this.testPortalService.markTesterCompleted(id);
    return { ...tester, password: undefined };
  }

  // ============= TESTER LOGIN =============

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async testerLogin(@Body() dto: TesterLoginDto) {
    const tester = await this.testPortalService.validateTesterLogin(dto.email, dto.password);
    if (!tester) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      id: tester.id,
      email: tester.email,
      name: tester.name,
      language: tester.language,
      status: tester.status,
      currentPhase: tester.currentPhase,
      totalPhases: tester.totalPhases,
    };
  }

  // ============= FEEDBACK =============

  @Get('feedback')
  async getAllFeedback() {
    return this.testPortalService.getFeedback();
  }

  @Get('feedback/tester/:testerId')
  async getTesterFeedback(@Param('testerId') testerId: string) {
    return this.testPortalService.getFeedbackByTester(testerId);
  }

  @Post('feedback')
  async saveFeedback(@Body() dto: SaveFeedbackDto) {
    return this.testPortalService.saveFeedback(
      dto.testerId,
      dto.phaseId,
      dto.questionId,
      dto.value,
      dto.screenshotUrl,
    );
  }

  @Post('feedback/batch')
  async saveBatchFeedback(@Body() dto: SaveBatchFeedbackDto) {
    return this.testPortalService.saveBatchFeedback(dto.testerId, dto.phaseId, dto.answers);
  }

  // ============= BUG REPORTS =============

  @Get('bugs')
  async getAllBugs() {
    return this.testPortalService.getBugReports();
  }

  @Get('bugs/tester/:testerId')
  async getTesterBugs(@Param('testerId') testerId: string) {
    return this.testPortalService.getBugReportsByTester(testerId);
  }

  @Post('bugs')
  async createBug(@Body() dto: CreateBugReportDto) {
    return this.testPortalService.createBugReport(
      dto.testerId,
      dto.phaseId,
      dto.title,
      dto.description,
      dto.severity,
      dto.screenshotUrl,
    );
  }

  @Put('bugs/:id/status')
  async updateBugStatus(@Param('id') id: string, @Body() dto: UpdateBugStatusDto) {
    return this.testPortalService.updateBugStatus(id, dto.status);
  }

  // ============= STATISTICS =============

  @Get('stats')
  async getStats() {
    return this.testPortalService.getStats();
  }
}
