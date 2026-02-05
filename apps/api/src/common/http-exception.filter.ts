import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      response
        .status(status)
        .json(
          typeof exceptionResponse === 'string'
            ? { statusCode: status, message: exceptionResponse }
            : exceptionResponse
        );
      return;
    }

    // Capture non-HTTP exceptions in Sentry
    Sentry.captureException(exception);

    this.logger.error(
      `Unhandled exception: ${(exception as Error).message}`,
      (exception as Error).stack
    );

    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}
