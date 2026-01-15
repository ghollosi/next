import { Module } from '@nestjs/common';
import { DriverService } from './driver.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
