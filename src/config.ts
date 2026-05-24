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
