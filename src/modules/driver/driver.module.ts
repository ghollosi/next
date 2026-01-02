import { Module } from '@nestjs/common';
import { DriverService } from './driver.service';

@Module({
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
