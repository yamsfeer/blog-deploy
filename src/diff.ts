import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { parseFrontmatter } from './frontmatter';
import { ArticleEntry } from './types';

/**
 * 计算文件正文的 SHA256 hash（排除 frontmatter）
 */
function computeBodyHash(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { body } = parseFrontmatter(content);
  return crypto.createHash('sha256').update(body).digest('hex');
}

/**
 * 检查源文件是否与部署仓库中的同名文件不同
 * @param sourcePath 源文件的绝对路径
 * @param deployPath 部署仓库根路径
 * @param fileName 部署仓库中 posts/ 下的文件名
 */
export function isModified(sourcePath: string, deployPath: string, fileName: string): boolean {
  const deployFilePath = path.join(deployPath, 'posts', fileName);

  // 部署仓库中不存在 → 视为已修改
  if (!fs.existsSync(deployFilePath)) {
    return true;
  }

  const sourceHash = computeBodyHash(sourcePath);
  const deployHash = computeBodyHash(deployFilePath);
  return sourceHash !== deployHash;
}

/**
 * 对已发布状态的条目设置 isModified 标记
 */
export function markModifiedEntries(
  entries: ArticleEntry[],
  sourceDir: string,
  deployPath?: string | null,
): void {
  if (!deployPath) return; // 无 deploy 路径时跳过修改检测
  for (const entry of entries) {
    if (entry.effectiveStatus === 'published') {
      const sourcePath = path.join(sourceDir, entry.relativePath);
      entry.isModified = isModified(sourcePath, deployPath, entry.fileName);
    }
  }
}
