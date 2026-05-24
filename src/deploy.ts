import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { BlogConfig, ArticleEntry } from './types';
import chalk from 'chalk';

/**
 * 在部署仓库目录中执行 git 命令
 */
function git(deployPath: string, command: string): string {
  try {
    return execSync(`git ${command}`, {
      cwd: deployPath,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();
  } catch (err: any) {
    const stderr = err.stderr || err.message;
    throw new Error(`Git 命令失败: git ${command}\n${stderr}`);
  }
}

/**
 * 验证部署仓库存在且是 git 仓库
 */
export function ensureDeployRepo(deployPath: string): void {
  if (!fs.existsSync(deployPath)) {
    throw new Error(`部署仓库路径不存在: ${deployPath}\n请先 clone 部署仓库到这个位置。`);
  }

  const gitDir = path.join(deployPath, '.git');
  if (!fs.existsSync(gitDir)) {
    throw new Error(`${deployPath} 不是一个 Git 仓库。`);
  }
}

/**
 * 检查部署仓库工作区是否干净
 */
export function checkClean(deployPath: string): boolean {
  const status = git(deployPath, 'status --porcelain');
  return status === '';
}

/**
 * 拉取最新代码
 */
export function pullLatest(deployPath: string): void {
  git(deployPath, 'pull origin main');
}

/**
 * 复制文件到部署仓库的 posts/ 目录
 */
export function copyToDeploy(sourcePath: string, deployPath: string, fileName: string): void {
  const postsDir = path.join(deployPath, 'posts');
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }

  const targetPath = path.join(postsDir, fileName);
  fs.copyFileSync(sourcePath, targetPath);
}

/**
 * 从部署仓库删除文件
 */
export function removeFromDeploy(deployPath: string, fileNames: string[]): void {
  for (const fileName of fileNames) {
    const filePath = path.join(deployPath, 'posts', fileName);
    if (fs.existsSync(filePath)) {
      git(deployPath, `rm "posts/${fileName}"`);
    }
  }
}

/**
 * 提交并推送
 */
export function commitAndPush(deployPath: string, message: string): void {
  git(deployPath, 'add -A');
  git(deployPath, `commit -m "${message}"`);
  git(deployPath, 'push origin main');
}

/**
 * 生成 commit message
 */
function makeCommitMessage(entries: ArticleEntry[], action: string): string {
  const titles = entries
    .map((e) => e.frontmatter.title || e.slug)
    .slice(0, 3)
    .join(', ');

  const more = entries.length > 3 ? ` 等 ${entries.length} 篇` : '';
  return `${action}: ${entries.length} 篇文章 — ${titles}${more}`;
}

/**
 * 发布文章：复制到部署仓库并推送
 */
export function deployArticles(config: BlogConfig, entries: ArticleEntry[]): void {
  console.log(chalk.blue('\n正在检查部署仓库...'));
  ensureDeployRepo(config.deployPath);

  if (!checkClean(config.deployPath)) {
    throw new Error(
      '部署仓库有未提交的变更，请先在部署仓库中处理：\n' +
        `  cd ${config.deployPath}\n` +
        '  git status',
    );
  }

  console.log(chalk.blue('正在拉取最新代码...'));
  pullLatest(config.deployPath);

  console.log(chalk.blue(`正在复制 ${entries.length} 篇文章到部署仓库...`));
  for (const entry of entries) {
    const sourcePath = path.join(process.cwd(), entry.relativePath);
    copyToDeploy(sourcePath, config.deployPath, entry.fileName);
    console.log(chalk.dim(`  → ${entry.fileName}`));
  }

  console.log(chalk.blue('正在提交并推送...'));
  const msg = makeCommitMessage(entries, 'publish');
  commitAndPush(config.deployPath, msg);

  console.log(chalk.green(`\n已发布 ${entries.length} 篇文章。部署将在几分钟内自动上线。`));
}

/**
 * 下架文章：从部署仓库删除并推送
 */
export function undeployArticles(config: BlogConfig, entries: ArticleEntry[]): void {
  console.log(chalk.blue('\n正在检查部署仓库...'));
  ensureDeployRepo(config.deployPath);

  if (!checkClean(config.deployPath)) {
    throw new Error(
      '部署仓库有未提交的变更，请先在部署仓库中处理：\n' +
        `  cd ${config.deployPath}\n` +
        '  git status',
    );
  }

  console.log(chalk.blue('正在拉取最新代码...'));
  pullLatest(config.deployPath);

  const names = entries.map((e) => e.fileName);
  console.log(chalk.blue(`正在从部署仓库删除 ${entries.length} 篇文章...`));
  removeFromDeploy(config.deployPath, names);

  console.log(chalk.blue('正在提交并推送...'));
  const msg = makeCommitMessage(entries, 'unpublish');
  commitAndPush(config.deployPath, msg);

  console.log(chalk.green(`\n已下架 ${entries.length} 篇文章。`));
}
