import { ApiProperty } from "@nestjs/swagger";

export class HealthDataDto {
  @ApiProperty({ example: "Welcome to Nest Template" })
  greeting: string;
}
