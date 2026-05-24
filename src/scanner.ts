import * as fs from 'fs';
import * as path from 'path';
import { ArticleEntry } from './types';
import { readArticle, resolveEffectiveStatus } from './frontmatter';

/**
 * 递归扫描源目录，返回所有 .md 文件的 ArticleEntry 列表
 * 忽略以 . 开头的目录
 */
export function scanSourceDir(sourceDir: string): ArticleEntry[] {
  const entries: ArticleEntry[] = [];

  function walk(dir: string, parentRel: string) {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      // 跳过隐藏目录
      if (item.isDirectory() && item.name.startsWith('.')) continue;

      const fullPath = path.join(dir, item.name);
      const relPath = parentRel ? `${parentRel}/${item.name}` : item.name;

      if (item.isDirectory()) {
        walk(fullPath, relPath);
      } else if (item.isFile() && item.name.endsWith('.md')) {
        const { fm } = readArticle(fullPath);
        const slug = item.name.replace(/\.md$/, '');

        entries.push({
          relativePath: relPath,
          fileName: item.name,
          slug,
          frontmatter: fm,
          effectiveStatus: resolveEffectiveStatus(fm),
          isModified: false, // 由调用方在 diff 阶段设置
        });
      }
    }
  }

  walk(sourceDir, '');
  return entries;
}
