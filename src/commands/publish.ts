import { Command } from 'commander';
import * as fs from 'fs';
import * as readline from 'readline';
import path from 'path';
import dayjs from 'dayjs';
import { resolveConfig } from '../config';
import { scanSourceDir } from '../scanner';
import { markModifiedEntries } from '../diff';
import { updateFrontmatter } from '../frontmatter';
import { deployArticles } from '../deploy';
import { selectArticles } from '../selector';
import { printSuccess, printError, printInfo } from '../renderer';
import { ArticleEntry } from '../types';
import chalk from 'chalk';

/**
 * 交互式询问部署仓库路径
 */
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

export const publishCommand = new Command('publish')
  .summary('发布文章到博客')
  .description(
    '将草稿或已修改的文章发布到线上博客。\n\n' +
    '  默认进入交互模式，在终端中用上下箭头和空格选择要发布的文章。\n' +
    '  如果没有通过 --deploy 或 .blogrc 指定部署仓库路径，会在选择文章后询问。',
  )
  .option('-a, --all', '一键发布所有可发布的文章（草稿 + 已修改）')
  .option('-l, --last', '快速发布最近修改过的一篇草稿')
  .option('-y, --yes', '跳过确认提示，直接发布（需配合 --all 使用）')
  .argument(
    '[files...]',
    '直接指定要发布的文件路径（空格分隔）。如: blog publish tech/docker.md life/note.md',
  )
  .addHelpText(
    'after',
    '\n示例:\n' +
    '  $ blog publish                 进入交互模式选择文章，如未配置 deploy 路径会询问\n' +
    '  $ blog publish --all           一键发布所有草稿和已修改的文章\n' +
    '  $ blog publish --all --yes     跳过确认，直接发布（适合 CI/脚本）\n' +
    '  $ blog publish --last          快速发布最近修改过的一篇草稿\n' +
    '  $ blog publish posts/hello.md  直接发布指定文件\n' +
    '  $ blog publish a.md b.md       一次发布多篇文章\n' +
    '  $ blog --deploy ~/blog publish 通过全局选项指定部署路径\n' +
    '\n说明:\n' +
    '  只有 status 为 draft 或已发布但内容有修改的文章才会出现在发布列表中。\n' +
    '  note（未分类）和 idea（想法）的文章不会出现在发布列表。\n' +
    '  发布后，文章 status 将变为 published，同时记录 published_at 和 updated_at。',
  )
  .action(async (files: string[], options, command: Command) => {
    const globals = command.parent?.opts() || {};
    const { sourceDir, deployPath: rawDeploy } = resolveConfig(globals);
    let deployPath = rawDeploy; // 可能在交互询问后才确定

    // 1. 扫描并标记修改状态（无 deploy 路径时跳过修改检测）
    const allEntries = scanSourceDir(sourceDir);
    markModifiedEntries(allEntries, sourceDir, deployPath);

    let selectedEntries: ArticleEntry[];

    if (options.all) {
      // --all: 发布所有草稿 + 已修改
      selectedEntries = allEntries.filter(
        (e) => e.effectiveStatus === 'draft' || e.isModified,
      );
      if (selectedEntries.length === 0) {
        printInfo('没有需要发布的文章。');
        return;
      }
      console.log(chalk.blue(`将发布 ${selectedEntries.length} 篇文章：`));
      for (const e of selectedEntries) {
        console.log(chalk.dim(`  • ${e.frontmatter.title || e.slug}`));
      }
      if (!options.yes) {
        console.log();
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.yellow('确认发布? (y/N) '), resolve);
        });
        rl.close();
        if (answer.toLowerCase() !== 'y') {
          printInfo('已取消。');
          return;
        }
      }
    } else if (options.last) {
      // --last: 最新修改的一篇草稿
      const drafts = allEntries.filter((e) => e.effectiveStatus === 'draft');
      if (drafts.length === 0) {
        printInfo('没有草稿可供发布。');
        return;
      }
      drafts.sort((a, b) => {
        const aStat = fs.statSync(
          path.join(sourceDir, a.relativePath),
        );
        const bStat = fs.statSync(
          path.join(sourceDir, b.relativePath),
        );
        return bStat.mtimeMs - aStat.mtimeMs;
      });
      selectedEntries = [drafts[0]];
    } else if (files.length > 0) {
      // 直接指定文件
      const fileSet = new Set(files.map((f) => path.normalize(f)));
      selectedEntries = allEntries.filter((e) => fileSet.has(e.relativePath));

      const skipped = selectedEntries.filter(
        (e) => e.effectiveStatus === 'published' && !e.isModified,
      );
      selectedEntries = selectedEntries.filter(
        (e) => !(e.effectiveStatus === 'published' && !e.isModified),
      );

      if (skipped.length > 0) {
        console.log(
          chalk.dim(`已跳过 ${skipped.length} 篇已发布且未修改的文章。`),
        );
      }
    } else {
      // 交互式多选
      selectedEntries = await selectArticles(allEntries, 'publish');
    }

    if (selectedEntries.length === 0) {
      printInfo('没有需要发布的文章。');
      return;
    }

    // 如果没有 deploy 路径，交互式询问（在选择文章之后）
    if (!deployPath) {
      console.log();
      console.log(chalk.dim('未找到部署仓库路径（可通过 --deploy 或 blog init 预先配置）。'));
      deployPath = await askDeployPath();
      if (!deployPath) {
        return; // askDeployPath 已打印错误信息
      }
    }

    // 2. 更新每个文件的 frontmatter
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ssZ');
    console.log(chalk.blue(`\n正在更新 ${selectedEntries.length} 篇文章的 frontmatter...`));

    for (const entry of selectedEntries) {
      const filePath = path.join(sourceDir, entry.relativePath);
      updateFrontmatter(filePath, {
        status: 'published',
        published_at: now,
        updated_at: now,
      });
      console.log(chalk.dim(`  → ${entry.fileName}`));
    }

    // 3. 部署
    try {
      deployArticles({ deployPath }, selectedEntries);
    } catch (err: any) {
      printError(err.message);
      process.exit(1);
    }
  });
