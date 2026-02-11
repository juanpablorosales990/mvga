import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { SocialService } from './social.service';
import { LookupUserDto, SyncContactsDto, ResolveAddressesDto } from './social.dto';

@ApiTags('Social')
@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  // ── Public User Lookup ─────────────────────────────────────────────

  @Get('lookup')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Look up user by username or citizen number' })
  async lookupUser(@Query() dto: LookupUserDto) {
    return this.socialService.lookupUser(dto);
  }

  // ── Contacts (authenticated) ───────────────────────────────────────

  @Get('contacts')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get synced contacts with resolved profiles' })
  async getContacts(@CurrentUser('id') userId: string) {
    return this.socialService.getContacts(userId);
  }

  @Post('contacts')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Sync contacts from client' })
  async syncContacts(@CurrentUser('id') userId: string, @Body() dto: SyncContactsDto) {
    return this.socialService.syncContacts(userId, dto.contacts);
  }

  @Delete('contacts/:address')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Remove a contact' })
  async removeContact(@CurrentUser('id') userId: string, @Param('address') address: string) {
    return this.socialService.removeContact(userId, address);
  }

  // ── Batch Resolve ──────────────────────────────────────────────────

  @Post('contacts/resolve')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Batch resolve addresses to usernames/displayNames' })
  async resolveAddresses(@Body() dto: ResolveAddressesDto) {
    return this.socialService.resolveAddresses(dto.addresses);
  }
}
