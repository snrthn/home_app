import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, Role } from '@laoma/shared';
import { isBlacklisted } from './token-blacklist';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload & { jti?: string; exp?: number }) {
    if (!payload?.sub || !payload?.role) throw new UnauthorizedException();
    if (isBlacklisted(payload.jti))
      throw new UnauthorizedException('登录已失效，请重新登录');
    return {
      sub: payload.sub,
      role: payload.role as Role,
      phone: payload.phone,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
