import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'mvga-api',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Root endpoint' })
  root() {
    return {
      name: 'MVGA API',
      version: '0.1.0',
      docs: '/docs',
    };
  }
}
