import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private readonly connectionTarget: string;

  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.get('db.url');

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not defined in the environment variables',
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(connectionString);
    } catch {
      throw new Error(
        'DATABASE_URL is invalid. Expected format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE',
      );
    }

    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error(
        `DATABASE_URL protocol must be postgresql:// (received "${parsed.protocol}//")`,
      );
    }

    if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
      throw new Error(
        'DATABASE_URL is incomplete. Host and database name are required.',
      );
    }

    const connectionTarget = `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
    this.connectionTarget = connectionTarget;

    this.logger.log(
      `PrismaService initialized (target: ${this.connectionTarget})`,
    );
  }

  async onModuleInit() {
    this.logger.log(
      `Prisma client connecting to database at ${this.connectionTarget}...`,
    );

    try {
      await this.$connect();
      // Force a real round-trip; $connect alone can succeed before auth/network fails
      await this.$queryRaw`SELECT 1`;
      this.logger.log(
        `Successfully connected to the database via PrismaPg adapter (${this.connectionTarget})`,
      );
    } catch (error) {
      const reason = this.formatConnectionError(error);
      this.logger.error(
        `Failed to connect to database at ${this.connectionTarget}: ${reason}`,
      );

      await this.pool.end().catch(() => undefined);

      throw new Error(
        `Cannot connect to PostgreSQL using DATABASE_URL (target: ${this.connectionTarget}). ${reason}`,
      );
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting Prisma client and closing pg pool...');
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database connections closed');
  }

  private formatConnectionError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    const messageMatch = raw.match(/Message:\s*`([^`]+)`/);
    if (messageMatch?.[1]) {
      return messageMatch[1];
    }

    return raw.replace(/\s+/g, ' ').trim();
  }
}
