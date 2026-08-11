import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Role, JwtPayload } from '@laoma/shared';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { blacklistToken } from './token-blacklist';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetPasswordDto } from './dto/set-password.dto';

interface CodeRecord {
  code: string;
  expires: number;
}

@Injectable()
export class AuthService {
  // MVP: 验证码存内存，不接真实短信网关，打印到控制台
  private codes = new Map<string, CodeRecord>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async sendSmsCode(phone: string): Promise<{ ok: boolean }> {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.codes.set(phone, { code, expires: Date.now() + 5 * 60 * 1000 });
    // eslint-disable-next-line no-console
    console.log(`[SMS-MOCK] 验证码 ${code} (phone=${phone})`);
    return { ok: true };
  }

  private verifyCode(phone: string, code: string): boolean {
    const rec = this.codes.get(phone);
    if (!rec) return false;
    if (rec.expires < Date.now()) {
      this.codes.delete(phone);
      return false;
    }
    if (rec.code !== code) return false;
    this.codes.delete(phone);
    return true;
  }

  // 账号状态校验：非 active（禁用 / 冻结）一律拒绝登录与 token 续期，
  // 解决「禁用后仍能登录」的问题。status 为可选（兼容历史数据），缺省视为 active。
  private assertActive(user: { status?: string | null }) {
    if (user.status && user.status !== 'active') {
      throw new UnauthorizedException('该账号已被禁用或冻结，无法登录');
    }
  }

  // 签发 token：除基础字段外，额外嵌入管理端 RBAC 上下文（岗位角色 + 权限码集合）。
  // 权限以 DB 为真相源，改角色/权限后由前端重新登录或刷新 token 生效。
  private async issueTokens(user: { id: string; role: string; phone: string }) {
    const staff = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        staffRoleId: true,
        staffRole: {
          select: {
            key: true,
            permissions: {
              select: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });
    const staffRoleId = staff?.staffRoleId ?? null;
    const staffRoleKey = staff?.staffRole?.key ?? null;
    const perms =
      staff?.staffRole?.permissions?.map((p) => p.permission.code) ?? [];

    const jti = randomUUID();
    const payload = {
      sub: user.id,
      role: user.role,
      phone: user.phone,
      staffRoleId,
      staffRoleKey,
      perms,
      jti,
    };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      // 传数字：jsonwebtoken 把数字当“秒”；无单位字符串"3600"会被 ms 库当成毫秒(3.6s)
      expiresIn: Number(this.config.get('JWT_ACCESS_TTL') ?? 3600),
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: Number(this.config.get('JWT_REFRESH_TTL') ?? 604800),
    });
    return { accessToken, refreshToken, role: user.role };
  }

  // 退出登录：幂等。从 Authorization 头解出 token 并拉黑其 jti。
  // 即使 token 已过期 / 已被拉黑 / 缺失，也一律返回成功（视为已退出），
  // 避免退出接口因 JwtAuthGuard 校验失败而返回 401。
  async logoutFromHeader(authHeader?: string) {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;
    if (token) {
      try {
        const payload = this.jwt.verify<JwtPayload & { jti?: string; exp?: number }>(
          token,
          { secret: this.config.get('JWT_ACCESS_SECRET') },
        );
        if (payload?.jti) blacklistToken(payload.jti, payload.exp);
      } catch {
        // 已失效的 token：无需处理，直接视为已退出
      }
    }
    return { ok: true };
  }

  // 私有：创建客户账号（自动昵称）；同步建 UserProfile（1:1）
  private async autoRegisterCustomer(phone: string, nickname?: string) {
    return this.prisma.user.create({
      data: {
        phone,
        role: Role.Customer,
        profile: {
          create: { nickname: nickname || `用户${phone.slice(-4)}` },
        },
      },
    });
  }

  // 私有：创建师傅账号（user + master 同事务，默认待审核）
  // 登录时无法收集真实姓名/城市，先用占位值，后续由师傅在「完善资料」页补充
  private async autoRegisterMaster(phone: string) {
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          phone,
          role: Role.Master,
          profile: {
            create: { nickname: `师傅${phone.slice(-4)}` },
          },
        },
      });
      await tx.master.create({
        data: {
          userId: u.id,
          realName: `师傅${phone.slice(-4)}`,
          city: '待完善',
          status: 'pending',
        },
      });
      return u;
    });
  }

  async registerCustomer(phone: string, code: string, nickname?: string) {
    if (!this.verifyCode(phone, code))
      throw new BadRequestException('验证码无效或已过期');
    const exist = await this.prisma.user.findUnique({ where: { phone } });
    if (exist) throw new BadRequestException('该手机号已注册');
    const user = await this.autoRegisterCustomer(phone, nickname);
    return await this.issueTokens(user);
  }

  async registerMaster(
    phone: string,
    code: string,
    realName?: string,
    city?: string,
  ) {
    if (!realName || !city) {
      throw new BadRequestException('师傅注册需填写真实姓名与所在城市');
    }
    if (!this.verifyCode(phone, code))
      throw new BadRequestException('验证码无效或已过期');
    const exist = await this.prisma.user.findUnique({ where: { phone } });
    if (exist) throw new BadRequestException('该手机号已注册');
    // user + master 同事务创建；师傅默认待审核（pending），由管理员激活后可接单
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { phone, role: Role.Master, profile: { create: { nickname: realName } } },
      });
      await tx.master.create({
        data: { userId: u.id, realName, city, status: 'pending' },
      });
      return u;
    });
    return await this.issueTokens(user);
  }

  // 验证码登录：首次登录即自动注册（OTP 登录=注册），不再提示“无此用户”
  async loginByCode(
    phone: string,
    code: string,
    role: 'customer' | 'master' = 'customer',
  ) {
    if (!this.verifyCode(phone, code))
      throw new BadRequestException('验证码无效或已过期');
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user =
        role === Role.Master
          ? await this.autoRegisterMaster(phone)
          : await this.autoRegisterCustomer(phone);
    }
    this.assertActive(user);
    return await this.issueTokens(user);
  }

  async adminLogin(phone: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || user.role !== Role.Admin)
      throw new UnauthorizedException('管理员账号不存在');
    if (!user.passwordHash)
      throw new UnauthorizedException('管理员未设置密码');
    this.assertActive(user);
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('密码错误');
    return await this.issueTokens(user);
  }

  // 密码登录（客户/师傅/管理员通用）：按手机号查用户，校验 passwordHash。
  // 账号不存在或未设置密码时给出明确提示，引导走验证码注册。
  async loginByPassword(phone: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new UnauthorizedException('账号不存在，请先使用验证码登录注册');
    this.assertActive(user);
    if (!user.passwordHash)
      throw new UnauthorizedException('该账号尚未设置密码，请先登录后在个人中心设置');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('密码错误');
    return await this.issueTokens(user);
  }

  // 设置 / 重置登录密码（需登录态）。
  // 已有密码时必须校验旧密码（重置）；无密码时直接设置（首次设置）。
  async setPassword(userId: string, dto: SetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    if (user.passwordHash) {
      if (!dto.oldPassword)
        throw new BadRequestException('请先输入当前密码');
      const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
      if (!ok) throw new BadRequestException('当前密码错误');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) throw new UnauthorizedException();
      this.assertActive(user);
      return await this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('refresh token 无效');
    }
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        master: true,
        staffRole: {
          include: {
            permissions: { include: { permission: { select: { code: true } } } },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    // 登录态下被禁用/冻结：拦截用户信息接口，前端据此清除登录态并跳转登录页
    this.assertActive(user);
    // 扁平化返回：昵称/头像/实名/性别/生日/所在地已迁移到 UserProfile
    const p = user.profile;
    const rolePerms =
      user.staffRole?.permissions?.map((rp) => rp.permission.code) ?? [];
    const base = {
      id: user.id,
      role: user.role,
      phone: user.phone,
      status: user.status,
      nickname: p?.nickname ?? null,
      avatar: p?.avatar ?? null,
      realName: p?.realName ?? null,
      gender: p?.gender ?? null,
      birthday: p?.birthday ?? null,
      province: p?.province ?? null,
      provinceCode: p?.provinceCode ?? null,
      city: p?.city ?? null,
      cityCode: p?.cityCode ?? null,
      district: p?.district ?? null,
      districtCode: p?.districtCode ?? null,
      bio: p?.bio ?? null,
      hasPassword: !!user.passwordHash,
      // 管理端 RBAC 上下文（仅 role=admin 有意义，其它端为 null/[]）
      staffRole: user.staffRole
        ? { id: user.staffRole.id, key: user.staffRole.key, name: user.staffRole.name }
        : null,
      perms: rolePerms,
    };
    // 师傅额外返回自身专属资料（实名/身份证/技能/服务区域/审核状态）
    if (user.role === Role.Master && user.master) {
      const m = user.master;
      return {
        ...base,
        master: {
          realName: m.realName,
          idCard: m.idCard,
          skills: m.skills,
          status: m.status,
          province: m.province ?? null,
          provinceCode: m.provinceCode ?? null,
          city: m.city ?? null,
          cityCode: m.cityCode ?? null,
          district: m.district ?? null,
          districtCode: m.districtCode ?? null,
        },
      };
    }
    return base;
  }

  // PATCH /api/auth/profile：更新 UserProfile（昵称/头像/实名/性别/生日/所在地/个人描述）
  // 仅更新传入的非空字段；UserProfile 总是存在（注册时已建），用 upsert 兜底。
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const fieldMap: Record<string, keyof UpdateProfileDto> = {
      nickname: 'nickname',
      avatar: 'avatar',
      realName: 'realName',
      gender: 'gender',
      birthday: 'birthday',
      province: 'province',
      provinceCode: 'provinceCode',
      city: 'city',
      cityCode: 'cityCode',
      district: 'district',
      districtCode: 'districtCode',
      bio: 'bio',
    };
    // 可清空字段：传空串时写 null（长文本类字段用户需要能删干净），
    // 其余字段沿用旧语义——空串视为「未修改」直接跳过。
    const CLEARABLE = new Set(['bio']);
    const data: Record<string, unknown> = {};
    for (const col of Object.keys(fieldMap)) {
      const v = dto[fieldMap[col]];
      if (v === undefined) continue;
      if (v === '') {
        if (!CLEARABLE.has(col)) continue;
        data[col] = null;
        continue;
      }
      data[col] = col === 'birthday' ? new Date(v as string) : v;
    }
    if (Object.keys(data).length === 0) return this.profile(userId);
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.profile(userId);
  }
}
