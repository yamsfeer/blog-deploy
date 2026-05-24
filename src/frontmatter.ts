import * as fs from 'fs';
import matter from 'gray-matter';
import { ArticleStatus, Frontmatter } from './types';

/**
 * 解析文件中的 frontmatter
 */
export function parseFrontmatter(content: string): { data: Frontmatter; body: string } {
  const result = matter(content);
  return {
    data: result.data as Frontmatter,
    body: result.content,
  };
}

/**
 * 读取文件并解析 frontmatter
 */
export function readArticle(
  filePath: string,
): { fullContent: string; fm: Frontmatter; body: string } {
  const fullContent = fs.readFileSync(filePath, 'utf-8');
  const { data, body } = parseFrontmatter(fullContent);
  return { fullContent, fm: data, body };
}

/**
 * 将 frontmatter 值序列化为安全的 YAML 字符串
 * 处理 gray-matter 解析出的 Date 对象等特殊情况
 */
function serializeValue(value: any): string {
  if (value instanceof Date) {
    // 格式化为 YYYY-MM-DD
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * 序列化 frontmatter 为 YAML-like 字符串
 */
function serializeFrontmatter(fm: Frontmatter): string {
  const lines: string[] = ['---'];

  // 保持合理的字段顺序
  const orderedKeys = ['title', 'date', 'status', 'published_at', 'updated_at'];
  const remainingKeys = Object.keys(fm).filter((k) => !orderedKeys.includes(k));

  for (const key of orderedKeys) {
    if (fm[key] !== undefined && fm[key] !== null) {
      const value = fm[key];
      lines.push(`${key}: ${serializeValue(value)}`);
    }
  }

  for (const key of remainingKeys) {
    if (fm[key] !== undefined && fm[key] !== null) {
      lines.push(`${key}: ${serializeValue(fm[key])}`);
    }
  }

  lines.push('---');
  return lines.join('\n') + '\n';
}

/**
 * 将 frontmatter 和正文写回文件
 * 如果文件已有 frontmatter 则替换，否则在开头插入
 */
export function writeFrontmatter(filePath: string, fm: Frontmatter, body: string): void {
  const yamlBlock = serializeFrontmatter(fm);
  // 确保 body 前后没有多余的换行
  const trimmedBody = body.replace(/^\n+/, '').replace(/\n+$/, '');
  const newContent = yamlBlock + '\n' + trimmedBody + '\n';
  fs.writeFileSync(filePath, newContent);
}

/**
 * 部分更新文件的 frontmatter
 * - 文件无 frontmatter 时自动创建
 * - 传入字段会被合并进现有 frontmatter（传入 undefined 表示删除该字段）
 */
export function updateFrontmatter(filePath: string, update: Partial<Frontmatter>): void {
  const exists = fs.existsSync(filePath);
  let fm: Frontmatter = {};
  let body = '';

  if (exists) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.trim().startsWith('---')) {
      const parsed = parseFrontmatter(content);
      fm = parsed.data;
      body = parsed.body;
    } else {
      body = content;
    }
  }

  // 合并更新
  for (const key of Object.keys(update)) {
    const value = (update as any)[key];
    if (value === undefined) {
      delete fm[key];
    } else {
      (fm as any)[key] = value;
    }
  }

  writeFrontmatter(filePath, fm, body);
}

/**
 * 从 frontmatter 推导有效状态
 */
export function resolveEffectiveStatus(fm: Frontmatter): ArticleStatus {
  if (fm.status === 'idea') return 'idea';
  if (fm.status === 'draft') return 'draft';
  if (fm.status === 'published') return 'published';
  // 没有 status 字段 → note（未分类）
  return 'note';
}
