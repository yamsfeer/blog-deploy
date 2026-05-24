import { Command } from 'commander';
import path from 'path';
import { updateFrontmatter, readArticle } from '../frontmatter';
import { printSuccess, printError } from '../renderer';

export const ideaCommand = new Command('idea')
  .description('将文章标记为想法，从发布列表中排除')
  .argument('<files...>', '要标记的文章路径')
  .action((files: string[]) => {
    const sourceDir = process.cwd();

    for (const file of files) {
      const filePath = path.resolve(sourceDir, file);
      const { fm } = readArticle(filePath);

      const updates: Record<string, any> = { status: 'idea' };

      updateFrontmatter(filePath, updates);
      printSuccess(`已标记为想法: ${file}`);
    }
  });
