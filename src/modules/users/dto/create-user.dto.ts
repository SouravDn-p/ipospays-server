import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";
import { Role } from "../../../generated/prisma/enums.js";

export class CreateUserDto {
  @ApiProperty({ example: "Jane Doe" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "jane@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "strongPassword123" })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: Role, example: Role.STAFF })
  @IsEnum(Role)
  role: Role;
}
