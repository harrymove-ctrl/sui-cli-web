/**
 * EventService - Parse and query Sui events
 */

import { SuiCliExecutor } from '../../cli/SuiCliExecutor';

export interface ParsedEvent {
  id: string;
  type: string;
  packageId: string;
  module: string;
  eventName: string;
  sender: string;
  transactionDigest: string;
  timestamp?: number;
  parsedFields: Record<string, any>;
  rawData: any;
}

export interface EventFilter {
  packageId?: string;
  module?: string;
  eventType?: string; // Full type string: packageId::module::EventName
  sender?: string;
  transactionDigest?: string;
}

export interface EventQueryResult {
  success: boolean;
  events: ParsedEvent[];
  nextCursor?: string;
  hasNextPage: boolean;
  error?: string;
}

export interface EventSchema {
  packageId: string;
  module: string;
  eventName: string;
  fields: Array<{
    name: string;
    type: string;
  }>;
}

export class EventService {
  private executor: SuiCliExecutor;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
  }

  /**
   * Parse event type string into components
   */
  private parseEventType(eventType: string): { packageId: string; module: string; eventName: string } {
    const parts = eventType.split('::');
    if (parts.length >= 3) {
      return {
        packageId: parts[0],
        module: parts[1],
        eventName: parts.slice(2).join('::'), // Handle generic types
      };
    }
    return {
      packageId: '',
      module: '',
      eventName: eventType,
    };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(event: any, index: number): string {
    const txDigest = event.id?.txDigest || event.transactionDigest || 'unknown';
    const eventSeq = event.id?.eventSeq || index;
    return `${txDigest}_${eventSeq}`;
  }

  /**
   * Parse raw event into structured format
   */
  private parseEvent(event: any, index: number): ParsedEvent {
    const typeInfo = this.parseEventType(event.type || '');

    return {
      id: this.generateEventId(event, index),
      type: event.type || '',
      packageId: typeInfo.packageId,
      module: typeInfo.module,
      eventName: typeInfo.eventName,
      sender: event.sender || '',
      transactionDigest: event.id?.txDigest || '',
      timestamp: event.timestampMs ? parseInt(event.timestampMs) : undefined,
      parsedFields: event.parsedJson || event.bcs || {},
      rawData: event,
    };
  }

  /**
   * Get events from a specific transaction
   */
  async getTransactionEvents(digest: string): Promise<EventQueryResult> {
    try {
      const args = ['client', 'tx-block', digest];
      const result = await this.executor.executeJson<any>(args);

      if (!result) {
        return {
          success: false,
          events: [],
          hasNextPage: false,
          error: 'Transaction not found',
        };
      }

      const rawEvents = result.events || [];
      const events = rawEvents.map((e: any, i: number) => this.parseEvent(e, i));

      return {
        success: true,
        events,
        hasNextPage: false,
      };
    } catch (error) {
      return {
        success: false,
        events: [],
        hasNextPage: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Query events with filters
   * Note: This uses RPC calls since CLI doesn't have direct event query
   */
  async queryEvents(
    filter: EventFilter,
    cursor?: string,
    limit: number = 50
  ): Promise<EventQueryResult> {
    try {
      // Build query based on filter type
      // The Sui RPC supports different query types:
      // - { Package: "0x..." }
      // - { MoveModule: { package: "0x...", module: "..." } }
      // - { MoveEventType: "0x...::module::EventName" }
      // - { Sender: "0x..." }
      // - { Transaction: "digest" }

      let queryFilter: any;

      if (filter.eventType) {
        queryFilter = { MoveEventType: filter.eventType };
      } else if (filter.module && filter.packageId) {
        queryFilter = {
          MoveModule: {
            package: filter.packageId,
            module: filter.module,
          },
        };
      } else if (filter.packageId) {
        queryFilter = { Package: filter.packageId };
      } else if (filter.sender) {
        queryFilter = { Sender: filter.sender };
      } else if (filter.transactionDigest) {
        queryFilter = { Transaction: filter.transactionDigest };
      } else {
        // Default to all events (not supported, return empty)
        return {
          success: true,
          events: [],
          hasNextPage: false,
        };
      }

      // Since we don't have direct RPC access, we'll use a workaround
      // For now, if we have a transaction digest, fetch that transaction's events
      if (filter.transactionDigest) {
        return this.getTransactionEvents(filter.transactionDigest);
      }

      // For other filters, we'd need to implement RPC calls
      // Return a helpful message
      return {
        success: false,
        events: [],
        hasNextPage: false,
        error: 'Event querying by filter requires RPC access. Please provide a transaction digest to view events.',
      };
    } catch (error) {
      return {
        success: false,
        events: [],
        hasNextPage: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get recent events from recent transactions
   * This is a workaround since we can't directly query events
   */
  async getRecentEvents(address: string, limit: number = 10): Promise<EventQueryResult> {
    try {
      // Get recent transactions for the address
      const args = ['client', 'objects', '--address', address];
      const result = await this.executor.executeJson<any>(args);

      // This approach is limited - ideally we'd use the events RPC
      return {
        success: true,
        events: [],
        hasNextPage: false,
      };
    } catch (error) {
      return {
        success: false,
        events: [],
        hasNextPage: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get event schema from Move module
   */
  async getEventSchema(
    packageId: string,
    module: string,
    eventName: string
  ): Promise<{ success: boolean; schema?: EventSchema; error?: string }> {
    try {
      // Get package info to extract event schema
      const args = ['client', 'object', '--id', packageId];
      const result = await this.executor.executeJson<any>(args);

      // Parse the Move module to find event struct
      // This is a simplified version - full implementation would parse Move bytecode

      return {
        success: true,
        schema: {
          packageId,
          module,
          eventName,
          fields: [], // Would need Move module parsing
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format event for display
   */
  formatEvent(event: ParsedEvent): {
    title: string;
    subtitle: string;
    fields: Array<{ key: string; value: string }>;
  } {
    const fields: Array<{ key: string; value: string }> = [];

    // Add standard fields
    fields.push({ key: 'Type', value: event.type });
    fields.push({ key: 'Transaction', value: event.transactionDigest });
    fields.push({ key: 'Sender', value: event.sender });

    if (event.timestamp) {
      fields.push({
        key: 'Time',
        value: new Date(event.timestamp).toISOString(),
      });
    }

    // Add parsed fields
    for (const [key, value] of Object.entries(event.parsedFields)) {
      fields.push({
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      });
    }

    return {
      title: event.eventName,
      subtitle: `${event.module} (${event.packageId.slice(0, 8)}...)`,
      fields,
    };
  }

  /**
   * Group events by type
   */
  groupEventsByType(events: ParsedEvent[]): Map<string, ParsedEvent[]> {
    const groups = new Map<string, ParsedEvent[]>();

    for (const event of events) {
      const existing = groups.get(event.type) || [];
      existing.push(event);
      groups.set(event.type, existing);
    }

    return groups;
  }

  /**
   * Filter events locally (after fetching)
   */
  filterEvents(events: ParsedEvent[], filter: Partial<EventFilter>): ParsedEvent[] {
    return events.filter(event => {
      if (filter.packageId && event.packageId !== filter.packageId) return false;
      if (filter.module && event.module !== filter.module) return false;
      if (filter.eventType && event.type !== filter.eventType) return false;
      if (filter.sender && event.sender !== filter.sender) return false;
      return true;
    });
  }
}
