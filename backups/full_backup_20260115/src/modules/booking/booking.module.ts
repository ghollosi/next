import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
