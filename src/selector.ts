import { checkbox } from '@inquirer/prompts';
import { ArticleEntry } from './types';

interface ChoiceItem {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
}

interface DirGroup {
  dir: string;
  entries: ArticleEntry[];
}

/**
 * 将文章列表按目录分组
 */
function groupByDirectory(entries: ArticleEntry[]): DirGroup[] {
  const map = new Map<string, ArticleEntry[]>();

  for (const entry of entries) {
    const parts = entry.relativePath.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    if (!map.has(dir)) map.set(dir, []);
    map.get(dir)!.push(entry);
  }

  // 按目录名排序
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, entries]) => ({
      dir,
      entries: entries.sort((a, b) => a.fileName.localeCompare(b.fileName)),
    }));
}

/**
 * 构建树形选择器选项
 */
function buildTreeChoices(
  groups: DirGroup[],
  mode: 'publish' | 'unpublish',
): ChoiceItem[] {
  const choices: ChoiceItem[] = [];

  for (const group of groups) {
    // 如果有子目录，显示目录头
    if (group.dir) {
      choices.push({
        name: `📁 ${group.dir}/`,
        value: `__dir__${group.dir}`,
        checked: false,
        disabled: true,
      });
    }

    const indent = group.dir ? '  ' : '';

    for (const entry of group.entries) {
      // publish 模式：只有 draft 和 modified 可选
      // unpublish 模式：只有 published 可选
      const isDisabled =
        mode === 'publish'
          ? entry.effectiveStatus !== 'draft' && !entry.isModified
          : entry.effectiveStatus !== 'published';

      const statusBadge = entry.isModified
        ? '[已修改]'
        : entry.effectiveStatus === 'published'
          ? `[${entry.frontmatter.date || '已发布'}]`
          : '';

      const title = entry.frontmatter.title || entry.slug;
      const displayName = isDisabled
        ? `${indent}├─ ${title} ${statusBadge} (不可选)`
        : `${indent}├─ ${title} ${statusBadge}`;

      choices.push({
        name: displayName,
        value: entry.relativePath,
        checked: false,
        disabled: isDisabled || false,
      });
    }
  }

  return choices;
}

/**
 * 交互式多选文章
 * @param entries 所有文章条目
 * @param mode 选择模式：publish 选择要发布的，unpublish 选择要下架的
 * @returns 用户选中的 ArticleEntry[]
 */
export async function selectArticles(
  entries: ArticleEntry[],
  mode: 'publish' | 'unpublish',
): Promise<ArticleEntry[]> {
  const groups = groupByDirectory(entries);
  const choices = buildTreeChoices(groups, mode);

  const availableChoices = choices.filter((c) => !c.disabled);

  if (availableChoices.length === 0) {
    if (mode === 'publish') {
      console.log('没有可发布的文章。');
      console.log('使用 blog draft <文件> 将文章标记为草稿后再发布。');
    } else {
      console.log('没有已发布的文章可供下架。');
    }
    return [];
  }

  const selectedValues = await checkbox({
    message:
      mode === 'publish'
        ? '选择要发布的文章 (空格选中/取消, 回车确认)'
        : '选择要下架的文章 (空格选中/取消, 回车确认)',
    choices,
    pageSize: 20,
  });

  // 过滤掉目录分隔符
  const validValues = selectedValues.filter((v) => !v.startsWith('__dir__'));

  return entries.filter((e) => validValues.includes(e.relativePath));
}
