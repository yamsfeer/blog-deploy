export type ArticleStatus = 'note' | 'idea' | 'draft' | 'published';

export interface Frontmatter {
  title?: string;
  date?: string;
  status?: 'draft' | 'published' | 'idea';
  published_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface ArticleEntry {
  /** 相对于源目录的路径，如 "tech/docker.md" */
  relativePath: string;
  /** 文件名，如 "docker.md" */
  fileName: string;
  /** slug，如 "docker" */
  slug: string;
  /** 解析出的 frontmatter 数据 */
  frontmatter: Frontmatter;
  /** 从 frontmatter.status 推导出的有效状态 */
  effectiveStatus: ArticleStatus;
  /** 是否已发布但内容有修改 */
  isModified: boolean;
}

export interface BlogConfig {
  /** 部署仓库的本地路径 */
  deployPath: string;
}
