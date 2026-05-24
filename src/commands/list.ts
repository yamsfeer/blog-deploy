import { Command } from 'commander';
import { getConfigOrExit } from '../config';
import { scanSourceDir } from '../scanner';
import { markModifiedEntries } from '../diff';
import { printList, ListMode } from '../renderer';

export const listCommand = new Command('list')
  .description('列出文章发布状态')
  .option('-a, --all', '显示所有文章（含已发布和未分类）')
  .option('--draft', '仅显示草稿')
  .option('--published', '仅显示已发布')
  .option('--modified', '仅显示已修改')
  .option('--idea', '仅显示想法')
  .action((options) => {
    const config = getConfigOrExit();
    const sourceDir = process.cwd();

    const entries = scanSourceDir(sourceDir);
    markModifiedEntries(entries, sourceDir, config.deployPath);

    // 确定显示模式
    let mode: ListMode = 'compact';
    if (options.all) mode = 'all';
    else if (options.draft) mode = 'draft';
    else if (options.published) mode = 'published';
    else if (options.modified) mode = 'modified';
    else if (options.idea) mode = 'idea';

    printList(entries, mode);
  });
