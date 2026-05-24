import { Command } from 'commander';
import * as fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { updateFrontmatter, readArticle } from '../frontmatter';
import { printSuccess, printError } from '../renderer';

export const draftCommand = new Command('draft')
  .description('将文章标记为草稿，纳入发布候选列表')
  .option('-i, --interactive', '交互式选择要标记的文章')
  .argument('[files...]', '要标记的文章路径')
  .action(async (files: string[], options) => {
    if (!files.length && !options.interactive) {
      printError('请指定文件路径，或使用 --interactive 模式');
      process.exit(1);
    }

    const sourceDir = process.cwd();
    const fileList = files;

    for (const file of fileList) {
      const filePath = path.resolve(sourceDir, file);
      const { fm } = readArticle(filePath);

      // 如果已有 title，保留；否则从文件名推断
      const updates: Record<string, any> = { status: 'draft' };

      if (!fm.title) {
        const name = path.basename(file, '.md');
        updates.title = name;
      }

      if (!fm.date) {
        // 使用文件修改时间
        const stat = fs.statSync(filePath);
        updates.date = dayjs(stat.mtime).format('YYYY-MM-DD');
      }

      updateFrontmatter(filePath, updates);
      printSuccess(`已标记为草稿: ${file}`);
    }
  });
