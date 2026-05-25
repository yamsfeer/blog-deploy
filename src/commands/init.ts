import { Command } from 'commander';
import * as fs from 'fs';
import path from 'path';
import { saveConfig } from '../config';
import { printSuccess, printError, printInfo } from '../renderer';
import chalk from 'chalk';

export const initCommand = new Command('init')
  .summary('初始化博客源目录，关联部署仓库')
  .description(
    '在当前目录创建 .blogrc 配置文件，关联一个本地的 GitHub Pages 部署仓库。\n' +
    '  执行后，你就可以在当前目录使用 blog list、blog publish 等命令了。\n' +
    '  部署仓库需要预先 clone 到本地，且必须是 Git 仓库。',
  )
  .requiredOption('-d, --deploy <path>', '部署仓库的本地绝对路径或相对路径')
  .addHelpText(
    'after',
    '\n示例:\n' +
    '  $ blog init --deploy ~/my-blog      指定部署仓库路径，在当前目录创建 .blogrc\n' +
    '  $ blog init --deploy ../blog-deploy  支持相对路径\n' +
    '\n提示:\n' +
    '  部署仓库通常是一个启用 GitHub Pages 的空仓库，\n' +
    '  包含 template/ 目录下的构建模板和 GitHub Actions 配置。',
  )
  .action((options) => {
    const deployPath = path.resolve(options.deploy);

    // 验证部署路径存在
    if (!fs.existsSync(deployPath)) {
      printError(`部署仓库路径不存在: ${deployPath}`);
      printInfo('请先 clone 部署仓库:');
      console.log(chalk.dim(`  git clone <仓库地址> ${deployPath}`));
      process.exit(1);
    }

    // 验证是 git 仓库
    const gitDir = path.join(deployPath, '.git');
    if (!fs.existsSync(gitDir)) {
      printError(`${deployPath} 不是一个 Git 仓库。`);
      process.exit(1);
    }

    // 写入配置
    saveConfig({ deployPath });

    printSuccess(`已创建 .blogrc，部署仓库路径: ${deployPath}`);
    console.log();
    console.log(chalk.dim('后续可以在当前目录执行 blog list 查看文章状态。'));
  });
