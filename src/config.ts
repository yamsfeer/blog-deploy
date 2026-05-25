import * as fs from 'fs';
import * as path from 'path';
import { BlogConfig } from './types';

const CONFIG_FILE = '.blogrc';

export function loadConfig(sourceDir?: string): BlogConfig | null {
  const dir = sourceDir || process.cwd();
  const configPath = path.join(dir, CONFIG_FILE);
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as BlogConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: BlogConfig, sourceDir?: string): void {
  const dir = sourceDir || process.cwd();
  const configPath = path.join(dir, CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

export function getConfigOrExit(sourceDir?: string): BlogConfig {
  const config = loadConfig(sourceDir);
  if (!config) {
    console.error('错误：当前目录没有 .blogrc 配置文件。');
    console.error('请先执行 blog init --deploy <部署仓库路径>');
    process.exit(1);
  }
  return config;
}

// ─── 新的灵活配置解析 ────────────────────────────────────────────────

export interface ResolvedConfig {
  /** 源目录（始终有值，默认为 process.cwd()） */
  sourceDir: string;
  /** 部署仓库路径（可能为 null，需调用方按需校验） */
  deployPath: string | null;
}

/**
 * 解析配置：CLI 参数优先，其次 .blogrc，最后默认值。
 * deployPath 可能为 null（用户未通过任何方式指定）。
 */
export function resolveConfig(cliOpts: {
  source?: string;
  deploy?: string;
}): ResolvedConfig {
  const sourceDir = cliOpts.source
    ? path.resolve(cliOpts.source)
    : process.cwd();

  let deployPath: string | null = null;
  if (cliOpts.deploy) {
    deployPath = path.resolve(cliOpts.deploy);
  } else {
    const config = loadConfig();
    if (config?.deployPath) deployPath = config.deployPath;
  }

  return { sourceDir, deployPath };
}

/**
 * 确保 deployPath 非空，否则打印错误并退出。
 * 用于 publish / unpublish 等必须指定部署仓库的命令。
 */
export function requireDeployPath(deployPath: string | null): string {
  if (!deployPath) {
    console.error('错误：未指定部署仓库路径。');
    console.error('可以通过以下方式指定：');
    console.error('  1. blog init --deploy <path>     创建 .blogrc 配置文件');
    console.error('  2. --deploy <path>               在命令行直接指定');
    process.exit(1);
  }
  return deployPath;
}
