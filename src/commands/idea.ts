import { Command } from 'commander';
import path from 'path';
import { resolveConfig } from '../config';
import { scanSourceDir } from '../scanner';
import { updateFrontmatter, readArticle } from '../frontmatter';
import { selectArticles } from '../selector';
import { printSuccess, printError } from '../renderer';
import { ArticleEntry } from '../types';

export const ideaCommand = new Command('idea')
  .summary('将文章标记为想法，从发布候选列表中排除')
  .description(
    '将文章标记为 idea（想法），这类文章不会出现在发布列表中。\n' +
    '  适合保存临时的灵感片段、待完善的笔记，不想在博客公开展示的内容。\n' +
    '  不指定文件时进入交互模式，可多选要标记的文章。\n' +
    '  使用 blog list --idea 可以查看所有标记为想法的文章。',
  )
  .argument(
    '[files...]',
    '要标记的文章路径（空格分隔）。不提供则进入交互模式。',
  )
  .addHelpText(
    'after',
    '\n示例:\n' +
    '  $ blog idea                      进入交互模式，多选要标记为想法的文章\n' +
    '  $ blog idea thoughts/note.md     标记单篇文章为想法\n' +
    '  $ blog idea a.md b.md c.md       一次标记多篇\n' +
    '\n说明:\n' +
    '  idea 状态的文章从发布列表中排除，可使用 blog list --idea 查看。\n' +
    '  需要发布时，先用 blog draft 将其改回草稿，再发布。',
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
      // 交互式多选：将 mode 改为 'draft' 的行为一致（note 和 idea 可选）
      const allEntries = scanSourceDir(sourceDir);
      selectedEntries = await selectArticles(allEntries, 'idea');
    }

    if (selectedEntries.length === 0) {
      return;
    }

    for (const entry of selectedEntries) {
      const filePath = path.join(sourceDir, entry.relativePath);

      const updates: Record<string, any> = { status: 'idea' };

      updateFrontmatter(filePath, updates);
      printSuccess(`已标记为想法: ${entry.relativePath}`);
    }
  });
