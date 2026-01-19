import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { LocationBillingService } from './location-billing.service';
import { BillingCycle } from '@prisma/client';

@Injectable()
export class LocationStatementScheduler {
  private readonly logger = new Logger(LocationStatementScheduler.name);

  constructor(
    private prisma: PrismaService,
    private locationBillingService: LocationBillingService,
  ) {}

  /**
   * Generate monthly statements for all subcontractor locations
   * Runs on the 1st of every month at 00:00
   */
  @Cron('0 0 1 * *')
  async generateMonthlyStatements() {
    this.logger.log('Starting monthly statement generation...');

    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // Last day of previous month
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0); // First day of previous month

    await this.generateStatementsForPeriod(periodStart, periodEnd, BillingCycle.MONTHLY);
  }

  /**
   * Generate weekly statements for locations with weekly billing cycle
   * Runs every Monday at 00:00
   */
  @Cron('0 0 * * 1')
  async generateWeeklyStatements() {
    this.logger.log('Starting weekly statement generation...');

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(now.getDate() - 1); // Yesterday (Sunday)
    periodEnd.setHours(23, 59, 59, 999);

    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodEnd.getDate() - 6); // Last Monday
    periodStart.setHours(0, 0, 0, 0);

    await this.generateStatementsForPeriod(periodStart, periodEnd, BillingCycle.WEEKLY);
  }

  /**
   * Generate statements for a specific period
   */
  private async generateStatementsForPeriod(
    periodStart: Date,
    periodEnd: Date,
    billingCycle: BillingCycle,
  ) {
    // Get all subcontractor locations with the specified billing cycle
    const locations = await this.prisma.location.findMany({
      where: {
        operationType: 'SUBCONTRACTOR',
        isActive: true,
        deletedAt: null,
        subcontractorBillingCycle: billingCycle,
      },
      include: {
        network: true,
        billingSettings: true,
      },
    });

    this.logger.log(`Found ${locations.length} subcontractor locations with ${billingCycle} billing cycle`);

    let successCount = 0;
    let errorCount = 0;

    for (const location of locations) {
      try {
        // Check if wash events exist for this period
        const washCount = await this.prisma.washEvent.count({
          where: {
            locationId: location.id,
            status: 'COMPLETED',
            completedAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        });

        if (washCount === 0) {
          this.logger.debug(`No wash events for location ${location.code}, skipping statement generation`);
          continue;
        }

        // Generate statement
        const statement = await this.locationBillingService.generateStatement(
          location.id,
          periodStart,
          periodEnd,
        );

        this.logger.log(
          `Generated statement for location ${location.code}: ` +
          `${statement.washCount} washes, ${statement.totalAmount} ${statement.currency}`,
        );

        // Send email notification
        await this.sendStatementNotification(location, statement);

        successCount++;
      } catch (error) {
        this.logger.error(
          `Failed to generate statement for location ${location.code}`,
          error,
        );
        errorCount++;
      }
    }

    this.logger.log(
      `Statement generation completed: ${successCount} success, ${errorCount} errors`,
    );
  }

  /**
   * Send email notification about the new statement
   */
  private async sendStatementNotification(location: any, statement: any) {
    try {
      const email = location.billingSettings?.contactEmail ||
                    location.subcontractorContactEmail;

      if (!email) {
        this.logger.warn(`No contact email for location ${location.code}, skipping notification`);
        return;
      }

      // Update statement with sent info
      await this.prisma.locationStatement.update({
        where: { id: statement.id },
        data: {
          sentAt: new Date(),
          sentToEmail: email,
        },
      });

      // TODO: Integrate with email service
      // For now, just log the notification
      this.logger.log(
        `Statement notification would be sent to ${email} for location ${location.code}: ` +
        `${statement.periodLabel}, ${statement.washCount} washes, ${statement.totalAmount} HUF`,
      );

      // Example email content that would be sent:
      // Subject: Mosási kimutatás - {periodLabel}
      // Body:
      // Tisztelt Alvállalkozó Partner!
      //
      // Az alábbi kimutatás készült el az Ön mosásairól:
      //
      // Időszak: {periodStart} - {periodEnd}
      // Mosások száma: {washCount}
      // Összesen: {totalAmount} HUF
      //
      // Kérjük, a kimutatás alapján állítsa ki számláját.
      // Számla szöveg: "{periodLabel} járműmosás gyűjtőszámla"
      //
      // A kimutatás részleteit a rendszerben megtekintheti.

    } catch (error) {
      this.logger.error(
        `Failed to send statement notification for location ${location.code}`,
        error,
      );
    }
  }

  /**
   * Manual trigger for generating statements (for testing or catch-up)
   */
  async generateStatementForLocation(
    locationId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: {
        network: true,
        billingSettings: true,
      },
    });

    if (!location) {
      throw new Error('Location not found');
    }

    if (location.operationType !== 'SUBCONTRACTOR') {
      throw new Error('Statements are only generated for SUBCONTRACTOR locations');
    }

    const statement = await this.locationBillingService.generateStatement(
      locationId,
      periodStart,
      periodEnd,
    );

    await this.sendStatementNotification(location, statement);

    return statement;
  }
}
