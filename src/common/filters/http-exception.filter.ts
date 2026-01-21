import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        error = (responseObj.error as string) || error;
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // SECURITY: Log error details server-side only
    if (status >= 500) {
      console.error('Server Error:', exception);
    }

    // SECURITY: Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';

    response.status(status).json({
      statusCode: status,
      error,
      // In production, hide detailed error messages for 500 errors
      message: isProduction && status >= 500 ? 'An unexpected error occurred' : message,
      timestamp: new Date().toISOString(),
    });
  }
}
