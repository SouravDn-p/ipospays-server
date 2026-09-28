import { ApiProperty } from "@nestjs/swagger";

export class IposConnectionDto {
  @ApiProperty({ example: "sandbox" })
  environment: string;

  @ApiProperty({ example: true })
  authenticated: boolean;

  @ApiProperty({ example: "00" })
  responseCode: string;

  @ApiProperty({ example: "Success" })
  responseMessage: string;

  @ApiProperty({
    example: true,
    description: "True when IPOSPAYS_TPN is set. The TPN value is not returned.",
  })
  tpnConfigured: boolean;
}

export class PaymentStatusDto {
  @ApiProperty({
    description: "Upstream iPOSpays status payload. Shape follows queryPaymentStatus.",
    type: "object",
    additionalProperties: true,
  })
  iposHPResponse: Record<string, unknown>;
}

export class HostedPaymentDto {
  @ApiProperty({ example: "sandbox" })
  environment: string;

  @ApiProperty({ example: "INV10001" })
  transactionReferenceId: string;

  @ApiProperty({
    example: "1050",
    description: "Amount sent to iPOSpays, in cents.",
  })
  amount: string;

  @ApiProperty({
    example: "https://payment.ipospays.tech/api/v1/externalPay?t=example",
  })
  paymentUrl: string;

  @ApiProperty({ example: "Url generated Successful" })
  responseMessage: string;
}
