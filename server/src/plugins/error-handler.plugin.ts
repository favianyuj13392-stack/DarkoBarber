import fp from 'fastify-plugin';
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

/**
 * Global error and 404 handling.
 *
 * - AppError subclasses keep the `{ error: <code>, message }` shape routes already use.
 * - ZodError (schema parse thrown instead of safeParse) -> 400 VALIDATION_ERROR with the
 *   same `issues` shape the routes return.
 * - Other 4xx errors (invalid JSON, payload too large, JWT, rate limit, ...) keep their
 *   own status and safe message, in Fastify's usual `{ statusCode, error, message }` shape.
 * - Anything else (including Prisma/driver errors) is logged in full with the request id
 *   and answered with a generic 500: no stack, no internal messages.
 */

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  408: 'Request Timeout',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
};

export const GENERIC_ERROR_MESSAGE = 'Internal server error';

export function handleError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.code, message: error.message });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: error.format() });
  }

  const err = error as Partial<FastifyError> & { error?: unknown; message?: unknown };
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;

  if (status >= 400 && status < 500) {
    return reply.status(status).send({
      statusCode: status,
      error: typeof err.error === 'string' ? err.error : (STATUS_TEXT[status] ?? 'Bad Request'),
      message: typeof err.message === 'string' ? err.message : 'Bad request',
    });
  }

  request.log.error({ err: error, reqId: request.id }, 'Unhandled error');
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: GENERIC_ERROR_MESSAGE,
    requestId: request.id,
  });
}

export default fp(async (fastify) => {
  fastify.setErrorHandler(handleError);

  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found' });
  });
});
