import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';
import { validateUploadFile } from '@laoma/shared';

@Injectable()
export class UploadService {
  private get dir() {
    return process.env.UPLOAD_DIR || './uploads';
  }

  async save(file: {
    originalname: string;
    buffer: Buffer;
    size: number;
    mimetype: string;
  }) {
    // 落盘前校验（规则来自共享 upload-rules，前后端单一事实来源）
    const v = validateUploadFile({
      sizeBytes: file.size,
      mime: file.mimetype,
    });
    if (!v.ok) throw new BadRequestException(v.error);

    // 按 年/月 分目录存储，方便按时间排查与清理（如 /uploads/2027/08/xxx.png）
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const sub = join(this.dir, yyyy, mm);
    await fs.mkdir(sub, { recursive: true });
    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase();
    const name = crypto.randomBytes(12).toString('hex') + '.' + ext;
    const full = join(sub, name);
    await fs.writeFile(full, file.buffer);
    return { url: `/uploads/${yyyy}/${mm}/${name}` };
  }
}
