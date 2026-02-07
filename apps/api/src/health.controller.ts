import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Connection } from '@solana/web3.js';
import { PrismaService } from './common/prisma.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    const start = Date.now();

    // Database check
    let dbStatus = 'ok';
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
    } catch {
      dbStatus = 'error';
    }

    // Solana RPC check
    let rpcStatus = 'ok';
    let rpcLatency = 0;
    try {
      const rpcUrl = this.config.get<string>(
        'SOLANA_RPC_URL',
        'https://api.mainnet-beta.solana.com'
      );
      const connection = new Connection(rpcUrl);
      const rpcStart = Date.now();
      await connection.getSlot();
      rpcLatency = Date.now() - rpcStart;
    } catch {
      rpcStatus = 'degraded';
    }

    const totalLatency = Date.now() - start;
    const isHealthy = dbStatus === 'ok';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'mvga-api',
      uptime: Math.floor(process.uptime()),
      database: { status: dbStatus, latency: `${dbLatency}ms` },
      rpc: { status: rpcStatus, latency: `${rpcLatency}ms` },
      latency: `${totalLatency}ms`,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Root endpoint' })
  root() {
    return {
      name: 'MVGA API',
      version: '0.1.0',
      docs: process.env.NODE_ENV !== 'production' ? '/docs' : undefined,
    };
  }
}
