import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { ErrorResponseDto } from "./common/dto/api-response.dto.js";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter.js";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor.js";
import { assertRequiredAuthEnv } from "./common/utils/assert-auth-env.js";

async function start() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  assertRequiredAuthEnv(configService);

  app.use(helmet());

  const corsOrigins = (
    configService.get<string>("app.corsOrigin")
    || "http://localhost:3000,http://localhost:3001"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.setGlobalPrefix("api/v1");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Nest Template API")
    .setDescription(
      [
        "All JSON bodies use a shared envelope: success (`success: true`) or error (`success: false`).",
        "Auth uses httpOnly cookies. Mutating requests need header `x-csrf-token`.",
      ].join("\n"),
    )
    .setVersion("1.0")
    .addCookieAuth("access_token", {
      type: "apiKey",
      in: "cookie",
      name: "access_token",
    })
    .addApiKey(
      {
        type: "apiKey",
        in: "header",
        name: "x-csrf-token",
        description:
          "CSRF token from POST /auth/login (`data.csrfToken` or csrf_token cookie)",
      },
      "csrf",
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [ErrorResponseDto],
  });
  SwaggerModule.setup("api/docs", app, document, {
    useGlobalPrefix: false,
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: "Nest Template API",
  });

  const port = configService.get<string>("app.port") || 5000;
  await app.listen(port);
  console.log(`Nest Template API: http://localhost:${port}/api/v1`);
  console.log(`Swagger docs:      http://localhost:${port}/api/docs`);
}
await start();
