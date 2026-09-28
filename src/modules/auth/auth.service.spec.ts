import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service.js";
import { UsersService } from "../users/users.service.js";
import { PrismaService } from "../../services/prisma/prisma.service.js";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
