import { applyDecorators, HttpStatus, Type } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiExtraModels,
  ApiResponse,
  ApiSecurity,
  getSchemaPath,
} from "@nestjs/swagger";
import { ErrorResponseDto } from "../dto/api-response.dto.js";

function envelopeSchema(
  status: number,
  description: string,
  dataSchema: Record<string, unknown>,
) {
  return {
    type: "object",
    required: ["statusCode", "success", "message", "meta"],
    properties: {
      statusCode: { type: "number", example: status },
      success: { type: "boolean", example: true },
      message: { type: "string", example: description },
      data: dataSchema,
      meta: {
        type: "object",
        properties: {
          statusCode: { type: "number", example: status },
          path: { type: "string" },
          timestamp: { type: "string" },
        },
      },
    },
  };
}

function withError(
  errorStatus: HttpStatus,
  errorDescription: string,
) {
  return ApiResponse({
    status: errorStatus,
    description: errorDescription,
    type: ErrorResponseDto,
  });
}

export function ApiAuth() {
  return applyDecorators(
    ApiCookieAuth("access_token"),
    ApiSecurity("csrf"),
  );
}

/** One success + one error (Swagger max 3; these two are required). */
export function ApiOkAndError<TModel extends Type<unknown>>(
  dataDto: TModel,
  successDescription: string,
  errorStatus = HttpStatus.UNAUTHORIZED,
  errorDescription = "Unauthorized",
) {
  return applyDecorators(
    ApiExtraModels(dataDto, ErrorResponseDto),
    ApiResponse({
      status: HttpStatus.OK,
      description: successDescription,
      schema: envelopeSchema(HttpStatus.OK, successDescription, {
        $ref: getSchemaPath(dataDto),
      }),
    }),
    withError(errorStatus, errorDescription),
  );
}

export function ApiCreatedAndError<TModel extends Type<unknown>>(
  dataDto: TModel,
  successDescription: string,
  errorStatus = HttpStatus.BAD_REQUEST,
  errorDescription = "Validation failed",
) {
  return applyDecorators(
    ApiExtraModels(dataDto, ErrorResponseDto),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: successDescription,
      schema: envelopeSchema(HttpStatus.CREATED, successDescription, {
        $ref: getSchemaPath(dataDto),
      }),
    }),
    withError(errorStatus, errorDescription),
  );
}

export function ApiMessageAndError(
  successDescription: string,
  errorStatus = HttpStatus.UNAUTHORIZED,
  errorDescription = "Unauthorized",
) {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status: HttpStatus.OK,
      description: successDescription,
      schema: envelopeSchema(HttpStatus.OK, successDescription, {
        nullable: true,
        example: null,
      }),
    }),
    withError(errorStatus, errorDescription),
  );
}
