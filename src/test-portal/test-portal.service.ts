import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../modules/email/email.service';
import { TesterStatus, TesterLanguage } from '@prisma/client';

// Hardcoded admin credentials
const ADMIN_EMAIL = 'gabor.hollosi@vedox.hu';
const ADMIN_PASSWORD = 'VsysAdmin2024!';

@Injectable()
export class TestPortalService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Generate random password
  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // ============= ADMIN =============

  validateAdminLogin(email: string, password: string): boolean {
    return email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;
  }

  // ============= TESTERS =============

  async getTesters() {
    return this.prisma.tester.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            feedback: true,
            bugReports: true,
          },
        },
      },
    });
  }

  async getTesterById(id: string) {
    const tester = await this.prisma.tester.findUnique({
      where: { id },
      include: {
        feedback: true,
        bugReports: true,
      },
    });
    if (!tester) throw new NotFoundException('Tester not found');
    return tester;
  }

  async getTesterByEmail(email: string) {
    return this.prisma.tester.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async createTester(name: string, email: string, language: TesterLanguage) {
    // Check max testers (5)
    const count = await this.prisma.tester.count({
      where: { status: { not: 'EXPIRED' } },
    });
    if (count >= 5) {
      throw new BadRequestException('Maximum number of testers (5) reached');
    }

    // Check if email already exists
    const existing = await this.getTesterByEmail(email);
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const password = this.generatePassword();

    return this.prisma.tester.create({
      data: {
        email: email.toLowerCase(),
        name,
        password,
        language,
        status: 'INVITED',
        currentPhase: 1,
        totalPhases: 7,
      },
    });
  }

  async updateTester(id: string, data: Partial<{
    name: string;
    email: string;
    language: TesterLanguage;
    status: TesterStatus;
    currentPhase: number;
  }>) {
    const tester = await this.getTesterById(id);

    return this.prisma.tester.update({
      where: { id },
      data: {
        ...data,
        email: data.email ? data.email.toLowerCase() : undefined,
      },
    });
  }

  async deleteTester(id: string) {
    await this.getTesterById(id);
    return this.prisma.tester.delete({ where: { id } });
  }

  async regeneratePassword(id: string) {
    const tester = await this.getTesterById(id);
    const newPassword = this.generatePassword();

    await this.prisma.tester.update({
      where: { id },
      data: { password: newPassword },
    });

    return newPassword;
  }

  // ============= TESTER LOGIN =============

  async validateTesterLogin(email: string, password: string) {
    const tester = await this.prisma.tester.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!tester || tester.password !== password) {
      return null;
    }

    if (tester.status === 'EXPIRED') {
      return null;
    }

    // Update status to ACTIVE and last login
    const updated = await this.prisma.tester.update({
      where: { id: tester.id },
      data: {
        status: tester.status === 'INVITED' ? 'ACTIVE' : tester.status,
        lastLoginAt: new Date(),
      },
    });

    return updated;
  }

  // ============= FEEDBACK =============

  async getFeedback() {
    return this.prisma.testFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tester: true },
    });
  }

  async getFeedbackByTester(testerId: string) {
    return this.prisma.testFeedback.findMany({
      where: { testerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveFeedback(
    testerId: string,
    phaseId: number,
    questionId: string,
    value: string | number | boolean,
    screenshotUrl?: string,
  ) {
    return this.prisma.testFeedback.upsert({
      where: {
        testerId_questionId: { testerId, questionId },
      },
      update: {
        value: JSON.stringify(value),
        screenshotUrl,
      },
      create: {
        testerId,
        phaseId,
        questionId,
        value: JSON.stringify(value),
        screenshotUrl,
      },
    });
  }

  async saveBatchFeedback(
    testerId: string,
    phaseId: number,
    answers: { questionId: string; value: string | number | boolean }[],
  ) {
    const results = [];
    for (const answer of answers) {
      const result = await this.saveFeedback(testerId, phaseId, answer.questionId, answer.value);
      results.push(result);
    }
    return results;
  }

  // ============= BUG REPORTS =============

  async getBugReports() {
    return this.prisma.testBugReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tester: true },
    });
  }

  async getBugReportsByTester(testerId: string) {
    return this.prisma.testBugReport.findMany({
      where: { testerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBugReport(
    testerId: string,
    phaseId: number,
    title: string,
    description: string,
    severity: string,
    screenshotUrl?: string,
  ) {
    return this.prisma.testBugReport.create({
      data: {
        testerId,
        phaseId,
        title,
        description,
        severity,
        status: 'NEW',
        screenshotUrl,
      },
    });
  }

  async updateBugStatus(bugId: string, status: string) {
    return this.prisma.testBugReport.update({
      where: { id: bugId },
      data: { status },
    });
  }

  // ============= STATISTICS =============

  async getStats() {
    const testers = await this.prisma.tester.findMany();
    const feedback = await this.prisma.testFeedback.findMany();
    const bugs = await this.prisma.testBugReport.findMany();

    const activeTesters = testers.filter(t => t.status === 'ACTIVE').length;
    const completedTesters = testers.filter(t => t.status === 'COMPLETED').length;

    // Calculate average rating from all rating feedback
    const ratings = feedback
      .map(f => {
        try {
          const val = JSON.parse(f.value);
          return typeof val === 'number' ? val : null;
        } catch {
          return null;
        }
      })
      .filter((v): v is number => v !== null);

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

    // Calculate completion rate
    const totalPhases = testers.length * 7;
    const completedPhases = feedback.length > 0
      ? new Set(feedback.map(f => `${f.testerId}-${f.phaseId}`)).size
      : 0;
    const completionRate = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;

    return {
      totalTesters: testers.length,
      activeTesters,
      completedTesters,
      totalBugs: bugs.length,
      averageRating: Math.round(avgRating * 10) / 10,
      completionRate: Math.round(completionRate),
    };
  }

  // ============= MARK COMPLETED =============

  async markTesterCompleted(testerId: string) {
    return this.prisma.tester.update({
      where: { id: testerId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  // ============= SEND INVITE EMAIL =============

  async sendInviteEmail(testerId: string) {
    const tester = await this.getTesterById(testerId);

    const loginUrl = 'https://app.vemiax.com/test-portal';

    const htmlContent = tester.language === 'HU' ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .password { font-family: monospace; font-size: 24px; color: #0ea5e9; font-weight: bold; }
    .button { display: inline-block; background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Meghívó a tesztelésre</h1>
    </div>
    <div class="content">
      <p>Kedves ${tester.name}!</p>
      <p>Meghívást kaptál a vSys rendszer tesztelésére. Az alábbi adatokkal tudsz bejelentkezni:</p>

      <div class="credentials">
        <p><strong>Email:</strong> <a href="mailto:${tester.email}">${tester.email}</a></p>
        <p><strong>Jelszó:</strong></p>
        <p class="password">${tester.password}</p>
      </div>

      <p style="text-align: center;">
        <a href="${loginUrl}" class="button">Belépés a tesztportálra</a>
      </p>

      <p>A tesztelés során kérjük, kövesd az utasításokat és jelezd a hibákat a rendszerben.</p>
      <p>Köszönjük a segítségedet!</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 vSys Wash. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    ` : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .password { font-family: monospace; font-size: 24px; color: #0ea5e9; font-weight: bold; }
    .button { display: inline-block; background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Testing Invitation</h1>
    </div>
    <div class="content">
      <p>Dear ${tester.name}!</p>
      <p>You have been invited to test the vSys system. You can log in with the following credentials:</p>

      <div class="credentials">
        <p><strong>Email:</strong> <a href="mailto:${tester.email}">${tester.email}</a></p>
        <p><strong>Password:</strong></p>
        <p class="password">${tester.password}</p>
      </div>

      <p style="text-align: center;">
        <a href="${loginUrl}" class="button">Login to Test Portal</a>
      </p>

      <p>During testing, please follow the instructions and report any bugs you find.</p>
      <p>Thank you for your help!</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 vSys Wash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    await this.emailService.sendEmail({
      to: tester.email,
      subject: tester.language === 'HU' ? 'Meghívó a tesztelésre' : 'Testing Invitation',
      html: htmlContent,
    });

    return { success: true };
  }
}
