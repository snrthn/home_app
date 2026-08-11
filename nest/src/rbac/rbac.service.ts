import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FUNCTION_POINTS } from './function-points';

export interface CreateRoleBody {
  key: string;
  name: string;
  description?: string;
}
export interface UpdateRoleBody {
  name?: string;
  description?: string;
}

@Injectable()
export class RbacService {
  constructor(private prisma: PrismaService) {}

  /** 全量权限码，按 group 分组（供角色编辑页勾选） */
  async listPermissions() {
    const perms = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { code: 'asc' }],
    });
    const grouped: Record<string, typeof perms> = {};
    for (const p of perms) {
      (grouped[p.group] ??= []).push(p);
    }
    return grouped;
  }

  /** 角色列表（含权限明细、用户数） */
  async listRoles() {
    const roles = await this.prisma.staffRole.findMany({
      include: {
        _count: { select: { users: true, permissions: true } },
        permissions: { include: { permission: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((rp) => rp.permission),
    }));
  }

  async getRole(id: string) {
    const r = await this.prisma.staffRole.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!r) throw new NotFoundException('角色不存在');
    return {
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((rp) => rp.permission),
    };
  }

  /** 反查该角色权限覆盖的功能点（用 FUNCTION_POINTS 现算） */
  async getRoleFunctions(id: string) {
    const r = await this.prisma.staffRole.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: { select: { code: true } } } },
      },
    });
    if (!r) throw new NotFoundException('角色不存在');
    const codes = new Set(r.permissions.map((rp) => rp.permission.code));
    return FUNCTION_POINTS.filter((f) => codes.has(f.perm));
  }

  async createRole(body: CreateRoleBody) {
    if (!body.key || !body.name)
      throw new BadRequestException('key 与 name 必填');
    const exists = await this.prisma.staffRole.findUnique({
      where: { key: body.key },
    });
    if (exists) throw new BadRequestException('角色 key 已存在');
    return this.prisma.staffRole.create({
      data: { key: body.key, name: body.name, description: body.description },
    });
  }

  async updateRole(id: string, body: UpdateRoleBody) {
    const r = await this.prisma.staffRole.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('角色不存在');
    if (r.isSystem) throw new BadRequestException('系统角色不可编辑');
    return this.prisma.staffRole.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
      },
    });
  }

  async deleteRole(id: string) {
    const r = await this.prisma.staffRole.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('角色不存在');
    if (r.isSystem) throw new BadRequestException('系统角色不可删除');
    const count = await this.prisma.user.count({ where: { staffRoleId: id } });
    if (count > 0)
      throw new BadRequestException('仍有后台账号绑定该角色，无法删除');
    await this.prisma.staffRole.delete({ where: { id } });
    return { ok: true };
  }

  /** 整体替换某角色的权限集（事务） */
  async setRolePermissions(id: string, permissionCodes: string[]) {
    const r = await this.prisma.staffRole.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('角色不存在');
    if (r.isSystem) throw new BadRequestException('系统角色权限不可修改');
    const valid = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });
    if (valid.length !== permissionCodes.length)
      throw new BadRequestException('存在非法权限码');
    await this.prisma.$transaction([
      this.prisma.staffRolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.staffRolePermission.createMany({
        data: valid.map((p) => ({ roleId: id, permissionId: p.id })),
      }),
    ]);
    return { ok: true };
  }
}
