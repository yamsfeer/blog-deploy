import { Command } from 'commander';
import { resolveConfig } from '../config';
import { scanSourceDir } from '../scanner';
import { markModifiedEntries } from '../diff';
import { printList, ListMode } from '../renderer';

export const listCommand = new Command('list')
  .summary('列出文章发布状态')
  .description(
    '扫描当前目录下所有 Markdown 文件，按发布状态分类展示。\n' +
    '  默认只显示草稿（draft）和已修改（published + 内容有变化）的文章。\n' +
    '  使用各选项可以切换不同的过滤视图。',
  )
  .option('-a, --all', '显示所有文章，含 note（未分类）、idea、published')
  .option('--draft', '只显示状态为 draft（草稿）的文章')
  .option('--published', '只显示状态为 published（已发布）的文章')
  .option('--modified', '只显示已发布但内容有修改的文章')
  .option('--idea', '只显示状态为 idea（想法）的文章')
  .addHelpText(
    'after',
    '\n示例:\n' +
    '  $ blog list             默认：显示草稿和已修改的文章\n' +
    '  $ blog list --all       显示所有文章及其状态\n' +
    '  $ blog list --draft     只看草稿\n' +
    '  $ blog list --published 只看已发布的文章\n' +
    '  $ blog list --modified  只看需要重新发布的文章\n' +
    '  $ blog list --idea      只看标记为想法的文章\n' +
    '\n默认情况下 "blog" 不带参数等同于 "blog list"。',
  )
  .action((options, command: Command) => {
    const globals = command.parent?.opts() || {};
    const { sourceDir, deployPath } = resolveConfig(globals);

    const entries = scanSourceDir(sourceDir);
    markModifiedEntries(entries, sourceDir, deployPath);

    // 确定显示模式
    let mode: ListMode = 'compact';
    if (options.all) mode = 'all';
    else if (options.draft) mode = 'draft';
    else if (options.published) mode = 'published';
    else if (options.modified) mode = 'modified';
    else if (options.idea) mode = 'idea';

    printList(entries, mode);
  });
