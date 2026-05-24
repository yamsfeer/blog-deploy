import { Command } from 'commander';
import * as fs from 'fs';
import * as readline from 'readline';
import path from 'path';
import dayjs from 'dayjs';
import { getConfigOrExit } from '../config';
import { scanSourceDir } from '../scanner';
import { markModifiedEntries } from '../diff';
import { updateFrontmatter } from '../frontmatter';
import { deployArticles } from '../deploy';
import { selectArticles } from '../selector';
import { printSuccess, printError, printInfo } from '../renderer';
import { ArticleEntry } from '../types';
import chalk from 'chalk';

export const publishCommand = new Command('publish')
  .description('发布文章到博客')
  .option('-a, --all', '发布所有草稿和已修改的文章')
  .option('-l, --last', '快速发布最近修改的一篇草稿')
  .option('-y, --yes', '跳过确认，直接发布（需配合 --all）')
  .argument('[files...]', '要发布的文章路径（不提供则进入交互模式）')
  .action(async (files: string[], options) => {
    const config = getConfigOrExit();
    const sourceDir = process.cwd();

    // 1. 扫描并标记修改状态
    const allEntries = scanSourceDir(sourceDir);
    markModifiedEntries(allEntries, sourceDir, config.deployPath);

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
        // 简单确认
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
      // 按文件修改时间排序
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

      // 过滤掉 published 且未修改的
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
      deployArticles(config, selectedEntries);
    } catch (err: any) {
      printError(err.message);
      process.exit(1);
    }
  });
