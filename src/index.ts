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
  .description('管理 Markdown 博客文章的发布流程')
  .version('0.1.0');

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
