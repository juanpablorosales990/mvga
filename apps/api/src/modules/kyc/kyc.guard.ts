import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { KycService } from './kyc.service';

@Injectable()
export class KycGuard implements CanActivate {
  constructor(private readonly kycService: KycService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const approved = await this.kycService.isKycApproved(userId);
    if (!approved) {
      throw new ForbiddenException('KYC verification required');
    }

    return true;
  }
}
