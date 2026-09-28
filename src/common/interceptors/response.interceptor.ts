import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponse } from '../types/global.js';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<ApiResponse<T>> {
        const httpContext = context.switchToHttp();
        const response = httpContext.getResponse<Response>();
        const request = httpContext.getRequest<Request>();

        return next.handle().pipe(
            map((data: T | ApiResponse<T>) => {
                const statusCode = response.statusCode || HttpStatus.OK;
                const path = request.originalUrl || request.url;
                const timestamp = new Date().toISOString();

                const baseMeta = {
                    statusCode,
                    path,
                    timestamp,
                };

                // Controller already returned a full ApiResponse → merge meta only
                if (this.isApiResponse(data)) {
                    return {
                        ...data,
                        statusCode, // force the actual HTTP status
                        meta: {
                            ...(data.meta ?? {}),
                            ...baseMeta,
                        },
                    };
                }

                // 204 No Content → preferably no body
                if (statusCode === HttpStatus.NO_CONTENT) {
                    // Nest will still send the body if we return something.
                    // Returning null + setting status is the cleanest approach.
                    response.status(HttpStatus.NO_CONTENT);
                    return null as any; // or throw a special marker if you prefer
                }

                // Normal success wrapper
                return {
                    statusCode,
                    success: true,
                    message: this.getSuccessMessage(statusCode),
                    data: data ?? null,
                    meta: baseMeta,
                };
            }),
        );
    }

    private isApiResponse(data: unknown): data is ApiResponse<unknown> {
        return (
            data !== null &&
            typeof data === 'object' &&
            'success' in data &&
            typeof (data as any).success === 'boolean' &&
            'message' in data &&
            typeof (data as any).message === 'string'
        );
    }

    private getSuccessMessage(statusCode: number): string {
        switch (statusCode) {
            case HttpStatus.OK:
                return 'Request successful';
            case HttpStatus.CREATED:
                return 'Resource created successfully';
            case HttpStatus.ACCEPTED:
                return 'Request accepted';
            case HttpStatus.NO_CONTENT:
                return 'Request processed successfully';
            default:
                return 'Operation completed successfully';
        }
    }
}