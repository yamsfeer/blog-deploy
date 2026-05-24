import { Command } from 'commander';
import path from 'path';
import { getConfigOrExit } from '../config';
import { scanSourceDir } from '../scanner';
import { markModifiedEntries } from '../diff';
import { updateFrontmatter } from '../frontmatter';
import { undeployArticles } from '../deploy';
import { selectArticles } from '../selector';
import { printSuccess, printError, printInfo } from '../renderer';
import { ArticleEntry } from '../types';
import chalk from 'chalk';

export const unpublishCommand = new Command('unpublish')
  .description('下架已发布的文章')
  .argument('[files...]', '要下架的文章路径（不提供则进入交互模式）')
  .action(async (files: string[]) => {
    const config = getConfigOrExit();
    const sourceDir = process.cwd();

    // 扫描并标记修改状态
    const allEntries = scanSourceDir(sourceDir);
    markModifiedEntries(allEntries, sourceDir, config.deployPath);

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

    // 更新 frontmatter：改回 draft，移除 published_at
    console.log(
      chalk.blue(`\n正在更新 ${selectedEntries.length} 篇文章的 frontmatter...`),
    );
    for (const entry of selectedEntries) {
      const filePath = path.join(sourceDir, entry.relativePath);
      // 使用特殊方式删除 published_at
      updateFrontmatter(filePath, {
        status: 'draft',
        published_at: undefined,
      });
      console.log(chalk.dim(`  → ${entry.fileName}`));
    }

    // 从部署仓库删除
    try {
      undeployArticles(config, selectedEntries);
    } catch (err: any) {
      printError(err.message);
      process.exit(1);
    }
  });
