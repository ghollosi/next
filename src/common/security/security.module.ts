import { Module, Global } from '@nestjs/common';
import { AccountLockoutService } from './account-lockout.service';
import { CsrfService } from './csrf.service';
import { CsrfGuard } from './csrf.guard';

@Global()
@Module({
  providers: [AccountLockoutService, CsrfService, CsrfGuard],
  exports: [AccountLockoutService, CsrfService, CsrfGuard],
})
export class SecurityModule {}
