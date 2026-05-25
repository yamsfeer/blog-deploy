import { ArticleEntry } from './types';
import { selectFromFileTree } from './file-tree';

/**
 * 交互式多选文章
 * @param entries 所有文章条目
 * @param mode 选择模式：publish 选择要发布的，unpublish 选择要下架的
 * @returns 用户选中的 ArticleEntry[]
 */
export async function selectArticles(
  entries: ArticleEntry[],
  mode: 'publish' | 'unpublish' | 'draft' | 'idea',
): Promise<ArticleEntry[]> {
  return selectFromFileTree(entries, mode);
}
