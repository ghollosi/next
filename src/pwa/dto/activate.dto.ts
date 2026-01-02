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

export class ActivateResponseDto {
  @ApiProperty()
  driverId: string;

  @ApiProperty()
  networkId: string;

  @ApiProperty()
  partnerCompanyId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  partnerCompanyName: string;
}
