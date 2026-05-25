import { Command } from 'commander';
import * as fs from 'fs';
import * as readline from 'readline';
import path from 'path';
import { resolveConfig } from '../config';
import { scanSourceDir } from '../scanner';
import { markModifiedEntries } from '../diff';
import { updateFrontmatter } from '../frontmatter';
import { undeployArticles } from '../deploy';
import { selectArticles } from '../selector';
import { printSuccess, printError, printInfo } from '../renderer';
import { ArticleEntry } from '../types';
import chalk from 'chalk';

async function askDeployPath(): Promise<string | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise<string>((resolve) => {
    rl.question(chalk.yellow('请输入部署仓库的本地路径（绝对路径）: '), resolve);
  });
  rl.close();

  const raw = answer.trim();
  if (!raw) {
    printError('路径不能为空。');
    return null;
  }

  // Expand ~ to home directory
  const p = raw.startsWith('~') ? path.join(process.env.HOME || '', raw.slice(1)) : raw;

  if (!path.isAbsolute(p)) {
    printError(`请输入绝对路径，当前输入 "${raw}" 不是完整路径。`);
    return null;
  }

  if (!fs.existsSync(p)) {
    printError(`路径不存在: ${p}`);
    return null;
  }
  if (!fs.existsSync(path.join(p, '.git'))) {
    printError(`${p} 不是一个 Git 仓库。`);
    return null;
  }
  console.log(chalk.dim(`部署路径: ${p}`));
  return p;
}

export const unpublishCommand = new Command('unpublish')
  .summary('下架已发布的文章')
  .description(
    '将已发布的文章从线上博客移除，恢复为 draft 状态。\n' +
    '  执行后会从部署仓库删除对应文件、git commit & push，\n' +
    '  本地文章 status 改回 draft，移除 published_at 字段。\n' +
    '  不提供参数时进入交互模式，可多选要下架的文章。',
  )
  .argument(
    '[files...]',
    '要下架的文章路径（空格分隔）。不提供则进入交互模式。',
  )
  .addHelpText(
    'after',
    '\n示例:\n' +
    '  $ blog unpublish                 进入交互模式，多选要下架的文章\n' +
    '  $ blog unpublish tech/docker.md  直接下架指定文章\n' +
    '\n说明:\n' +
    '  只能下架已发布的文章（status: published）。\n' +
    '  下架后文章恢复为 draft，可在修改后重新发布。',
  )
  .action(async (files: string[], _, command: Command) => {
    const globals = command.parent?.opts() || {};
    const { sourceDir, deployPath: rawDeploy } = resolveConfig(globals);
    let deployPath = rawDeploy;

    // 扫描并标记修改状态
    const allEntries = scanSourceDir(sourceDir);
    markModifiedEntries(allEntries, sourceDir, deployPath);

    let selectedEntries: ArticleEntry[];

    if (files.length > 0) {
      // 直接指定文件
      const fileSet = new Set(files.map((f) => path.normalize(f)));
      selectedEntries = allEntries.filter(
        (e) =>
          e.effectiveStatus === 'published' && fileSet.has(e.relativePath),
      );
    } else {
      // 交互式多选
      selectedEntries = await selectArticles(allEntries, 'unpublish');
    }

    if (selectedEntries.length === 0) {
      printInfo('没有要下架的文章。');
      return;
    }

    // 如果没有 deploy 路径，交互式询问
    if (!deployPath) {
      console.log();
      console.log(chalk.dim('未找到部署仓库路径（可通过 --deploy 或 blog init 预先配置）。'));
      deployPath = await askDeployPath();
      if (!deployPath) {
        return;
      }
    }

    // 更新 frontmatter：改回 draft，移除 published_at
    console.log(
      chalk.blue(`\n正在更新 ${selectedEntries.length} 篇文章的 frontmatter...`),
    );
    for (const entry of selectedEntries) {
      const filePath = path.join(sourceDir, entry.relativePath);
      updateFrontmatter(filePath, {
        status: 'draft',
        published_at: undefined,
      });
      console.log(chalk.dim(`  → ${entry.fileName}`));
    }

    // 从部署仓库删除
    try {
      undeployArticles({ deployPath }, selectedEntries);
    } catch (err: any) {
      printError(err.message);
      process.exit(1);
    }
  });
