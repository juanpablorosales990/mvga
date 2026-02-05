import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';

@ValidatorConstraint({ async: false })
export class IsSolanaAddressConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    try {
      new PublicKey(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'Invalid Solana wallet address';
  }
}

export function IsSolanaAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSolanaAddressConstraint,
    });
  };
}

@Injectable()
export class ParseSolanaAddressPipe implements PipeTransform<string> {
  transform(value: string): string {
    try {
      new PublicKey(value);
      return value;
    } catch {
      throw new BadRequestException('Invalid Solana wallet address');
    }
  }
}
