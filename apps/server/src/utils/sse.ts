/**
 * Server-Sent Events (SSE) utilities for streaming responses
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface SSEMessage<T = any> {
  event?: string;
  data: T;
  id?: string;
  retry?: number;
}

/**
 * Format a message for SSE transmission
 */
export function formatSSEMessage<T>(message: SSEMessage<T>): string {
  let output = '';

  if (message.id) {
    output += `id: ${message.id}\n`;
  }

  if (message.event) {
    output += `event: ${message.event}\n`;
  }

  if (message.retry) {
    output += `retry: ${message.retry}\n`;
  }

  output += `data: ${JSON.stringify(message.data)}\n\n`;

  return output;
}

/**
 * Create an SSE endpoint handler
 */
export function createSSEHandler<TParams = any, TQuery = any, TData = any>(
  fastify: FastifyInstance,
  path: string,
  generator: (request: FastifyRequest<{ Params: TParams; Querystring: TQuery }>) => AsyncGenerator<TData>
) {
  fastify.get<{ Params: TParams; Querystring: TQuery }>(path, async (request, reply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection message
    reply.raw.write(formatSSEMessage({ event: 'connected', data: { timestamp: Date.now() } }));

    try {
      let messageId = 0;
      for await (const data of generator(request)) {
        if (reply.raw.destroyed) break;

        reply.raw.write(formatSSEMessage({
          data,
          id: String(++messageId)
        }));
      }

      // Send completion event
      reply.raw.write(formatSSEMessage({ event: 'complete', data: { timestamp: Date.now() } }));
    } catch (error) {
      // Send error event
      reply.raw.write(formatSSEMessage({
        event: 'error',
        data: { error: error instanceof Error ? error.message : String(error) }
      }));
    } finally {
      reply.raw.end();
    }
  });
}

/**
 * SSE Response helper class for more control
 */
export class SSEResponse {
  private reply: FastifyReply;
  private messageId: number = 0;
  private closed: boolean = false;

  constructor(reply: FastifyReply) {
    this.reply = reply;
  }

  /**
   * Initialize SSE connection
   */
  init(): void {
    this.reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
  }

  /**
   * Send a data message
   */
  send<T>(data: T, event?: string): void {
    if (this.closed || this.reply.raw.destroyed) return;

    this.reply.raw.write(formatSSEMessage({
      data,
      event,
      id: String(++this.messageId),
    }));
  }

  /**
   * Send a status update
   */
  status(message: string, progress?: number): void {
    this.send({ type: 'status', message, progress }, 'status');
  }

  /**
   * Send output line
   */
  output(line: string, stream: 'stdout' | 'stderr' = 'stdout'): void {
    this.send({ type: 'output', line, stream }, 'output');
  }

  /**
   * Send error
   */
  error(message: string): void {
    this.send({ type: 'error', message }, 'error');
  }

  /**
   * Send completion and close
   */
  complete<T>(result?: T): void {
    this.send({ type: 'complete', result }, 'complete');
    this.close();
  }

  /**
   * Close the connection
   */
  close(): void {
    if (!this.closed && !this.reply.raw.destroyed) {
      this.reply.raw.end();
      this.closed = true;
    }
  }

  /**
   * Check if connection is still open
   */
  isOpen(): boolean {
    return !this.closed && !this.reply.raw.destroyed;
  }
}

/**
 * Create an SSE response from a Fastify reply
 */
export function createSSEResponse(reply: FastifyReply): SSEResponse {
  const sse = new SSEResponse(reply);
  sse.init();
  return sse;
}
