import { Command } from 'commander';
import * as fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { resolveConfig } from '../config';
import { scanSourceDir } from '../scanner';
import { updateFrontmatter, readArticle } from '../frontmatter';
import { selectArticles } from '../selector';
import { printSuccess, printError } from '../renderer';
import { ArticleEntry } from '../types';

export const draftCommand = new Command('draft')
  .summary('将文章标记为草稿，纳入发布候选列表')
  .description(
    '将一篇或多篇 Markdown 文章的状态设置为 draft（草稿）。\n' +
    '  不指定文件时进入交互模式，可多选要标记的文章。\n' +
    '  如果文章没有 title，会自动从文件名推断；如果没有 date，会使用文件修改时间。',
  )
  .argument(
    '[files...]',
    '要标记的文章路径（空格分隔）。不提供则进入交互模式。',
  )
  .addHelpText(
    'after',
    '\n示例:\n' +
    '  $ blog draft                     进入交互模式，多选要标记为草稿的文章\n' +
    '  $ blog draft posts/hello.md      将单篇文章标记为草稿\n' +
    '  $ blog draft tech/docker.md life/travel.md  一次标记多篇\n' +
    '\n说明:\n' +
    '  标记为 draft 后，文章会出现在 blog list 和 blog publish 的发布列表中。\n' +
    '  note（未分类）和 idea（想法）状态的文章都可以标记为草稿。\n' +
    '  已是 draft 或 published 的文章不可选。',
  )
  .action(async (files: string[], options, command: Command) => {
    const globals = command.parent?.opts() || {};
    const { sourceDir } = resolveConfig(globals);

    let selectedEntries: ArticleEntry[];

    if (files.length > 0) {
      // 直接指定文件路径
      const fileSet = new Set(files.map((f) => path.normalize(f)));
      const allEntries = scanSourceDir(sourceDir);
      selectedEntries = allEntries.filter((e) => fileSet.has(e.relativePath));
    } else {
      // 交互式多选
      const allEntries = scanSourceDir(sourceDir);
      selectedEntries = await selectArticles(allEntries, 'draft');
    }

    if (selectedEntries.length === 0) {
      return;
    }

    for (const entry of selectedEntries) {
      const filePath = path.join(sourceDir, entry.relativePath);
      const { fm } = readArticle(filePath);

      const updates: Record<string, any> = { status: 'draft' };

      if (!fm.title) {
        const name = path.basename(entry.fileName, '.md');
        updates.title = name;
      }

      if (!fm.date) {
        const stat = fs.statSync(filePath);
        updates.date = dayjs(stat.mtime).format('YYYY-MM-DD');
      }

      updateFrontmatter(filePath, updates);
      printSuccess(`已标记为草稿: ${entry.relativePath}`);
    }
  });
