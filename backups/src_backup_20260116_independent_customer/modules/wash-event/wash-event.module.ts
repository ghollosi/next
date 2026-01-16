import { Module } from '@nestjs/common';
import { WashEventService } from './wash-event.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [WashEventService],
  exports: [WashEventService],
})
export class WashEventModule {}
