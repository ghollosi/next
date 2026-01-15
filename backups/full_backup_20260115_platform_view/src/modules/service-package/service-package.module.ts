import { Module } from '@nestjs/common';
import { ServicePackageService } from './service-package.service';

@Module({
  providers: [ServicePackageService],
  exports: [ServicePackageService],
})
export class ServicePackageModule {}
