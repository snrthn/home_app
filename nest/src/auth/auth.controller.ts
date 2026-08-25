import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  Get,
  Patch,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth-user.interface';
import { SendCodeDto } from './dto/send-code.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Role } from '@laoma/shared';
import { setRoleTokenCookie, clearRoleTokenCookie } from './cookie.util';

// 从 Authorization 头解出角色（仅用于退出时清掉对应角色的 cookie，无需验签）
function roleFromAuthHeader(auth?: string): string | null {
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(part.replace(/-/g, '+').replace(/_/g, '/')),
      ),
    );
    return json.role ?? null;
  } catch {
    return null;
  }
}

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @ApiOperation({ summary: '发送短信验证码' })
  @ApiBody({ type: SendCodeDto })
  @Post('send-code')
  sendCode(@Body() dto: SendCodeDto) {
    return this.auth.sendSmsCode(dto.phone);
  }

  @ApiOperation({ summary: '用户注册' })
  @ApiBody({ type: RegisterDto })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result =
      dto.role === Role.Master
        ? await this.auth.registerMaster(
            dto.phone,
            dto.code,
            dto.realName,
            dto.city,
          )
        : await this.auth.registerCustomer(dto.phone, dto.code || '', dto.nickname);
    setRoleTokenCookie(res, req, result.role, result.accessToken);
    return result;
  }

  @ApiOperation({ summary: '登录' })
  @ApiBody({ type: LoginDto })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const mode = dto.mode ?? (dto.role === Role.Admin ? 'admin' : 'code');
    let result;
    if (mode === 'admin') {
      result = await this.auth.adminLogin(dto.phone, dto.password || '');
    } else if (mode === 'password') {
      result = await this.auth.loginByPassword(dto.phone, dto.password || '');
    } else {
      const role = dto.role === Role.Master ? Role.Master : Role.Customer;
      result = await this.auth.loginByCode(dto.phone, dto.code || '', role);
    }
    setRoleTokenCookie(res, req, result.role, result.accessToken);
    return result;
  }

  @ApiOperation({ summary: '刷新令牌' })
  @ApiBody({ type: RefreshDto })
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.refreshToken(dto.refreshToken);
    setRoleTokenCookie(res, req, result.role, result.accessToken);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.auth.profile(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新个人资料' })
  @ApiBody({ type: UpdateProfileDto })
  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }

  // 设置 / 重置登录密码（需登录态）。已有密码时须传 oldPassword 校验。
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '设置/重置登录密码' })
  @ApiBody({ type: SetPasswordDto })
  @Post('password')
  setPassword(@CurrentUser() user: AuthUser, @Body() dto: SetPasswordDto) {
    return this.auth.setPassword(user.sub, dto);
  }

  // 找回密码（公开，无需登录态）：手机号 + 验证码 + 新密码，OTP 即身份凭证。
  @ApiOperation({ summary: '找回密码' })
  @ApiBody({ type: ResetPasswordDto })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPasswordByCode(dto.phone, dto.code, dto.newPassword);
  }

  // 登录心跳：刷新 lastActiveAt 保活「在线」状态，供工作台在线师傅统计。
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '登录心跳保活' })
  @Post('heartbeat')
  heartbeat(@CurrentUser() user: AuthUser) {
    return this.auth.heartbeat(user.sub);
  }

  // 退出登录：幂等（token 已失效/缺失也返回成功）；同时清除该角色的服务端 cookie
  @ApiOperation({ summary: '退出登录' })
  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') authorization?: string,
  ) {
    this.auth.logoutFromHeader(authorization);
    clearRoleTokenCookie(res, req, roleFromAuthHeader(authorization) ?? undefined);
    return { ok: true };
  }
}
