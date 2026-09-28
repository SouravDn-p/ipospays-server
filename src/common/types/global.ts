export interface GlobalResponse<T> {
    data: T;
    message: string;
}

export class ApiResponse<T> {
    statusCode: number;
    success: boolean;
    message: string;
    data?: T;
    meta?: Record<string, unknown>;

    constructor(
        statusCode: number = 200,
        success: boolean,
        message: string,
        data?: T,
        meta?: Record<string, unknown>,
    ) {
        this.statusCode = statusCode;
        this.success = success;
        this.message = message;
        if (data !== undefined) this.data = data;
        if (meta !== undefined) this.meta = meta;
    }

    static success<T>(
        data?: T,
        message = 'success',
        statusCode = 200,
        meta?: Record<string, unknown>,
    ): ApiResponse<T> {
        return new ApiResponse<T>(statusCode, true, message, data, meta);
    }

    static error(
        message: string,
        statusCode: number,
        meta?: Record<string, unknown>,
    ): ApiResponse<never> {
        return new ApiResponse<never>(statusCode, false, message, undefined, meta);
    }
}
