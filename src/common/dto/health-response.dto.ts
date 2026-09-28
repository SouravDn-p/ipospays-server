import { ApiProperty } from "@nestjs/swagger";

export class HealthDataDto {
  @ApiProperty({ example: "Welcome to iPOSpays Server" })
  greeting: string;
}
