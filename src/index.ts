#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { listCommand } from './commands/list';
import { draftCommand } from './commands/draft';
import { ideaCommand } from './commands/idea';
import { publishCommand } from './commands/publish';
import { unpublishCommand } from './commands/unpublish';

const program = new Command();

program
  .name('blog')
  .description(
    '管理 Markdown 博客文章的 CLI 工具。\n\n' +
    '  在你的笔记仓库中，用 blog 命令管理文章状态、一键发布到线上博客。\n' +
    '  支持草稿、想法标记，交互式多选发布，Git 自动提交等。',
  )
  .version('0.1.0')
  .option('--source <path>', '源目录（Markdown 文件所在目录），默认为当前目录')
  .option('--deploy <path>', '部署仓库本地路径（可替代 .blogrc 中的 deployPath）')
  .addHelpText(
    'after',
    '\n使用 "blog help <command>" 查看具体命令的详细帮助和示例。\n' +
    '使用 "blog" 不带任何参数将默认执行 list 命令。',
  );

program.addCommand(initCommand);
program.addCommand(listCommand);
program.addCommand(draftCommand);
program.addCommand(ideaCommand);
program.addCommand(publishCommand);
program.addCommand(unpublishCommand);

// 默认执行 list 命令
program.action(() => {
  listCommand.parse(['list']);
});

program.parse();
