import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
} from "class-validator";

export class CreateHostedPaymentDto {
  @ApiProperty({
    example: 10.5,
    description: "Charge amount in USD. 10.50 is sent to iPOSpays as 1050.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999.99)
  amount: number;

  @ApiPropertyOptional({
    example: "INV10001",
    description: "1-20 letters or digits. Generated when omitted.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,20}$/)
  transactionReferenceId?: string;

  @ApiPropertyOptional({ example: "https://merchant.example/payments/return" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  returnUrl?: string;

  @ApiPropertyOptional({ example: "https://merchant.example/payments/failure" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  failureUrl?: string;

  @ApiPropertyOptional({ example: "https://merchant.example/checkout" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;
}
