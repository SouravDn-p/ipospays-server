import { ArgumentsHost, Catch, ExceptionFilter, HttpCode, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ApiResponse } from "../types/global.js";
import { Response, Request } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { handlePrismaError } from "./prisma-exeption-handler.js";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name)

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const path = request.url;
        const timepstamp = new Date().toISOString();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = "Internal Server Error";
        let error = "InternalServerError";

        try {
            if (
                exception instanceof Prisma.PrismaClientKnownRequestError ||
                exception instanceof Prisma.PrismaClientValidationError
            ) {
                handlePrismaError(exception);
            }
        } catch (error) {
            exception = error;
        }


        if (exception instanceof HttpException) {
            status = exception.getStatus()
            const exceptionResponse = exception.getResponse()

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (
                typeof exceptionResponse === 'object' &&
                exceptionResponse !== null
            ) {
                const responseObj = exceptionResponse as Record<string, unknown>
                const raw = responseObj.message;
                if (Array.isArray(raw)) {
                    message = raw.join(', ');
                } else if (typeof raw === 'string') {
                    message = raw;
                }
            }

            error = exception.constructor.name;
        } else {
            this.logger.error(
                `Unhandled exception: ${String(exception)}`,
                exception instanceof Error ? exception.stack : undefined,
            );
        }

        const errorResponse: ApiResponse<null> = {
            statusCode: status,
            success: false,
            message,
            data: null,
            meta: { statusCode: status, path, timepstamp, error },
        };

        response.status(status).json(errorResponse);
    }

}