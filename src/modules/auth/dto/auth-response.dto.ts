import { ApiProperty } from "@nestjs/swagger";
import { UserResponseDto } from "../../users/dto/user-response.dto.js";

export class LoginDataDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({
    example: "a1b2c3d4e5f6",
    description: "Send this value as the x-csrf-token header on mutating requests",
  })
  csrfToken: string;
}

export class RefreshDataDto {
  @ApiProperty({
    example: "a1b2c3d4e5f6",
    description: "Rotated CSRF token",
  })
  csrfToken: string;
}
