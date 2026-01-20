import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateDto {
  @ApiProperty({
    description: 'Invite code sent to the driver',
    example: 'ABC123',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Invite code must be 6 uppercase alphanumeric characters',
  })
  inviteCode: string;

  @ApiProperty({
    description: '4-digit PIN',
    example: '1234',
  })
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, {
    message: 'PIN must be exactly 4 digits',
  })
  pin: string;
}

export class ActivateByPhoneDto {
  @ApiProperty({
    description: 'Phone number of the driver',
    example: '+36301234567',
  })
  @IsString()
  @Length(9, 20)
  phone: string;

  @ApiProperty({
    description: '4-digit PIN',
    example: '1234',
  })
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, {
    message: 'PIN must be exactly 4 digits',
  })
  pin: string;
}

export class ActivateByEmailDto {
  @ApiProperty({
    description: 'Email address of the driver',
    example: 'sofor@example.com',
  })
  @IsString()
  @Length(5, 100)
  email: string;

  @ApiProperty({
    description: '4-digit PIN',
    example: '1234',
  })
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, {
    message: 'PIN must be exactly 4 digits',
  })
  pin: string;
}

export class ActivateResponseDto {
  @ApiProperty()
  driverId: string;

  @ApiProperty()
  networkId: string;

  @ApiProperty({ nullable: true, description: 'Null for private customers' })
  partnerCompanyId: string | null;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ nullable: true, description: 'Null for private customers' })
  partnerCompanyName: string | null;

  @ApiProperty({ description: 'True if driver is a private customer (no partner company)' })
  isPrivateCustomer?: boolean;

  @ApiProperty({ nullable: true, description: 'Billing name for private customers' })
  billingName?: string | null;

  @ApiProperty({ nullable: true, description: 'Billing address for private customers' })
  billingAddress?: string | null;

  @ApiProperty({ nullable: true, description: 'Billing city for private customers' })
  billingCity?: string | null;

  @ApiProperty({ nullable: true, description: 'Billing zip code for private customers' })
  billingZipCode?: string | null;

  @ApiProperty({ nullable: true, description: 'Billing country for private customers' })
  billingCountry?: string | null;

  @ApiProperty({ nullable: true, description: 'Tax number for private customers' })
  billingTaxNumber?: string | null;
}
