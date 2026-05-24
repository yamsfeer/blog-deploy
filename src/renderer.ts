import chalk from 'chalk';
import { ArticleEntry, ArticleStatus } from './types';

const STATUS_LABELS: Record<ArticleStatus, string> = {
  note: '未分类',
  idea: '想法',
  draft: '草稿',
  published: '已发布',
};

const STATUS_COLORS: Record<ArticleStatus, (s: string) => string> = {
  note: chalk.gray,
  idea: chalk.magenta,
  draft: chalk.yellow,
  published: chalk.green,
};

export type ListMode = 'compact' | 'all' | 'draft' | 'published' | 'modified' | 'idea';

/**
 * 过滤条目
 */
function filterEntries(entries: ArticleEntry[], mode: ListMode): ArticleEntry[] {
  switch (mode) {
    case 'compact':
      // 只显示需要关注的：草稿 + 已修改
      return entries.filter(
        (e) => e.effectiveStatus === 'draft' || e.isModified,
      );
    case 'draft':
      return entries.filter((e) => e.effectiveStatus === 'draft');
    case 'published':
      return entries.filter(
        (e) => e.effectiveStatus === 'published' && !e.isModified,
      );
    case 'modified':
      return entries.filter((e) => e.isModified);
    case 'idea':
      return entries.filter((e) => e.effectiveStatus === 'idea');
    case 'all':
    default:
      return entries;
  }
}

/**
 * 获取条目的显示状态标签
 */
function getStatusLabel(entry: ArticleEntry): string {
  if (entry.isModified) return '[已修改]';
  return `[${STATUS_LABELS[entry.effectiveStatus]}]`;
}

/**
 * 获取状态标签颜色
 */
function getStatusColor(entry: ArticleEntry): (s: string) => string {
  if (entry.isModified) return chalk.red;
  return STATUS_COLORS[entry.effectiveStatus];
}

/**
 * 统计各状态数量
 */
function countByStatus(entries: ArticleEntry[]): Record<string, number> {
  const counts: Record<string, number> = {
    published: 0,
    modified: 0,
    draft: 0,
    idea: 0,
    note: 0,
  };

  for (const e of entries) {
    if (e.isModified) {
      counts.modified++;
    } else {
      counts[e.effectiveStatus]++;
    }
  }

  return counts;
}

/**
 * 打印文章列表
 */
export function printList(entries: ArticleEntry[], mode: ListMode): void {
  const filtered = filterEntries(entries, mode);

  if (filtered.length === 0) {
    console.log(chalk.dim('\n没有匹配的文章。'));
    printSummary(entries);
    return;
  }

  // 按路径排序
  filtered.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  // 打印表
  console.log();
  console.log(
    chalk.bold(
      `${'状态'.padEnd(12)} ${'标题'.padEnd(40)} ${'文件'}`,
    ),
  );
  console.log(chalk.dim('─'.repeat(80)));

  for (const entry of filtered) {
    const statusLabel = getStatusLabel(entry);
    const colorFn = getStatusColor(entry);
    const title = (entry.frontmatter.title || entry.slug).slice(0, 38);
    const date = entry.frontmatter.date
      ? chalk.dim(` ${entry.frontmatter.date}`)
      : '';

    console.log(
      `${colorFn(statusLabel.padEnd(12))} ${title.padEnd(40)}${chalk.dim(entry.relativePath)}`,
    );
  }

  // 打印汇总
  printSummary(entries);
}

/**
 * 打印状态汇总
 */
export function printSummary(entries: ArticleEntry[]): void {
  const counts = countByStatus(entries);

  console.log(chalk.dim('\n' + '─'.repeat(80)));
  console.log(
    chalk.dim(
      [
        `已发布: ${chalk.green(counts.published)} (正常)`,
        `已修改: ${chalk.red(counts.modified)}`,
        `草稿: ${chalk.yellow(counts.draft)}`,
        `想法: ${chalk.magenta(counts.idea)}`,
        `未分类: ${chalk.gray(counts.note)}`,
      ].join(' | '),
    ),
  );
  console.log();
}

/**
 * 成功消息
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * 错误消息
 */
export function printError(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

/**
 * 信息消息
 */
export function printInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}
