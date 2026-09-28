import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ResponseMetaDto {
  @ApiProperty({ example: 200, description: "HTTP status code" })
  statusCode: number;

  @ApiProperty({ example: "/api/v1/auth/login", description: "Request path" })
  path: string;

  @ApiProperty({
    example: "2026-09-28T05:00:00.000Z",
    description: "ISO-8601 timestamp",
  })
  timestamp: string;

  @ApiPropertyOptional({
    example: "UnauthorizedException",
    description: "Exception name on failed requests",
  })
  error?: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: "Invalid credentials" })
  message: string;

  @ApiProperty({
    type: "string",
    nullable: true,
    example: null,
    description: "Always null on errors",
  })
  data: string | null;

  @ApiProperty({ type: ResponseMetaDto })
  meta: ResponseMetaDto;
}

export class SuccessResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: "Request successful" })
  message: string;

  @ApiProperty({ type: ResponseMetaDto })
  meta: ResponseMetaDto;
}
