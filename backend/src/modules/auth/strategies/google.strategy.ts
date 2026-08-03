import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, Profile } from 'passport-google-oauth20';
import { GoogleOAuthConfig } from '../../../config/configuration';

const UNCONFIGURED_PLACEHOLDER = 'google-oauth-not-configured';

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const googleConfig = configService.get<GoogleOAuthConfig>(
      'google',
    ) as GoogleOAuthConfig;
    const options: StrategyOptions = {
      clientID: googleConfig.clientId || UNCONFIGURED_PLACEHOLDER,
      clientSecret: googleConfig.clientSecret || UNCONFIGURED_PLACEHOLDER,
      callbackURL: googleConfig.callbackUrl || UNCONFIGURED_PLACEHOLDER,
      scope: ['email', 'profile'],
    };
    super(options);
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error('Google profile did not include an email address');
    }
    return {
      googleId: profile.id,
      email: email.toLowerCase(),
      emailVerified: profile.emails?.[0]?.verified === true,
      fullName: profile.displayName || email,
    };
  }
}
