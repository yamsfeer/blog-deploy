import chalk from 'chalk';
import { ArticleEntry } from './types';

// ── Types ──

type SelectMode = 'publish' | 'unpublish' | 'draft' | 'idea';

interface FileTreeNode {
  type: 'directory' | 'file';
  name: string;
  path: string;
  depth: number;
  children: FileTreeNode[];

  // ── file ──
  entry?: ArticleEntry;
  selectable: boolean;
  disabled: boolean;
  statusLabel: string;
  selected: boolean;

  // ── directory ──
  expanded: boolean;
  childrenCount: number;
}

interface VisibleLine {
  node: FileTreeNode;
  index: number;
}

// ── Constants ──

const MODE_MESSAGES: Record<SelectMode, string> = {
  publish: '选择要发布的文章',
  unpublish: '选择要下架的文章',
  draft: '选择要标记为草稿的文章',
  idea: '选择要标记为想法的文章',
};

const MODE_COLORS: Record<SelectMode, chalk.Chalk> = {
  publish: chalk.green,
  unpublish: chalk.yellow,
  draft: chalk.cyan,
  idea: chalk.magenta,
};

const STATUS_COLORS: Record<string, chalk.Chalk> = {
  draft: chalk.yellow,
  published: chalk.green,
  modified: chalk.red,
  idea: chalk.magenta,
  note: chalk.gray,
};

// ── Tree building ──

function buildFileTree(
  entries: ArticleEntry[],
  mode: SelectMode,
): FileTreeNode[] {
  const dirNodes = new Map<string, FileTreeNode>();

  function ensureDir(dirPath: string): FileTreeNode {
    const existing = dirNodes.get(dirPath);
    if (existing) return existing;

    const parts = dirPath.split('/');
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const depth = parts.length - 1;

    const node: FileTreeNode = {
      type: 'directory',
      name,
      path: dirPath,
      depth,
      children: [],
      expanded: false,
      childrenCount: 0,
      selectable: false,
      disabled: true,
      statusLabel: '',
      selected: false,
    };

    dirNodes.set(dirPath, node);
    if (parentPath) ensureDir(parentPath).children.push(node);
    return node;
  }

  const rootFiles: FileTreeNode[] = [];

  for (const entry of entries) {
    const parts = entry.relativePath.split('/');
    const rawName = parts[parts.length - 1];
    const fileName = rawName.replace(/\.md$/, '');

    let parentDir: string;
    let depth: number;

    if (parts.length > 1) {
      parentDir = parts.slice(0, -1).join('/');
      depth = parts.length - 1;
      ensureDir(parentDir);
    } else {
      parentDir = '';
      depth = 0;
    }

    const baseStatus = entry.isModified ? 'modified' : entry.effectiveStatus;

    let selectable: boolean;
    let disabled: boolean;
    let statusLabel: string;

    if (mode === 'publish') {
      selectable = entry.effectiveStatus === 'draft' || entry.isModified;
      disabled = !selectable;
      statusLabel = baseStatus;
    } else if (mode === 'unpublish') {
      selectable = entry.effectiveStatus === 'published';
      disabled = !selectable;
      statusLabel = baseStatus;
    } else if (mode === 'idea') {
      selectable =
        entry.effectiveStatus !== 'idea' &&
        entry.effectiveStatus !== 'published';
      disabled = !selectable;
      statusLabel = baseStatus;
    } else {
      selectable =
        entry.effectiveStatus !== 'draft' &&
        entry.effectiveStatus !== 'published';
      disabled = !selectable;
      statusLabel = baseStatus;
    }

    const title = entry.frontmatter.title || fileName;

    const fileNode: FileTreeNode = {
      type: 'file',
      name: title,
      path: entry.relativePath,
      depth,
      children: [],
      entry,
      selectable,
      disabled,
      statusLabel,
      selected: false,
      expanded: false,
      childrenCount: 0,
    };

    if (parentDir && dirNodes.has(parentDir)) {
      dirNodes.get(parentDir)!.children.push(fileNode);
    } else {
      rootFiles.push(fileNode);
    }
  }

  const rootDirs = Array.from(dirNodes.values()).filter((n) => n.depth === 0);
  const rootNodes: FileTreeNode[] = [...rootDirs, ...rootFiles];

  function sortNodes(nodes: FileTreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    for (const n of nodes) sortNodes(n.children);
  }
  sortNodes(rootNodes);

  function computeCount(node: FileTreeNode): number {
    if (node.type === 'file') return 1;
    let total = 0;
    for (const child of node.children) total += computeCount(child);
    node.childrenCount = total;
    return total;
  }
  for (const node of rootNodes) computeCount(node);

  return rootNodes;
}

// ── Flatten visible ──

function flattenVisible(nodes: FileTreeNode[]): VisibleLine[] {
  const result: VisibleLine[] = [];
  function walk(node: FileTreeNode): void {
    result.push({ node, index: result.length });
    if (node.type === 'directory' && node.expanded) {
      for (const child of node.children) walk(child);
    }
  }
  for (const node of nodes) walk(node);
  return result;
}

// ── Count helpers ──

function countSelectedAll(nodes: FileTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file' && node.selected) count++;
    if (node.type === 'directory') count += countSelectedAll(node.children);
  }
  return count;
}

function countSelectedInDir(dir: FileTreeNode): number {
  let count = 0;
  for (const child of dir.children) {
    if (child.type === 'file' && child.selected) count++;
    if (child.type === 'directory') count += countSelectedInDir(child);
  }
  return count;
}

function countSelectableInDir(dir: FileTreeNode): number {
  let count = 0;
  for (const child of dir.children) {
    if (child.type === 'file' && child.selectable) count++;
    if (child.type === 'directory') count += countSelectableInDir(child);
  }
  return count;
}

function collectSelected(nodes: FileTreeNode[]): ArticleEntry[] {
  const result: ArticleEntry[] = [];
  for (const node of nodes) {
    if (node.type === 'file' && node.selected && node.entry) {
      result.push(node.entry);
    }
    if (node.type === 'directory') {
      result.push(...collectSelected(node.children));
    }
  }
  return result;
}

function hasSelectableFile(nodes: FileTreeNode[]): boolean {
  for (const node of nodes) {
    if (node.type === 'file' && node.selectable) return true;
    if (node.type === 'directory' && hasSelectableFile(node.children))
      return true;
  }
  return false;
}

// ── Select / deselect all in directory ──

function selectAllInDir(dir: FileTreeNode): void {
  for (const child of dir.children) {
    if (child.type === 'file' && child.selectable) child.selected = true;
    if (child.type === 'directory') selectAllInDir(child);
  }
}

function deselectAllInDir(dir: FileTreeNode): void {
  for (const child of dir.children) {
    if (child.type === 'file') child.selected = false;
    if (child.type === 'directory') deselectAllInDir(child);
  }
  // Deselect this directory node's own selected state too
  dir.selected = false;
}

// ── Find parent directory in visible lines (for left-arrow collapse) ──

function findParentDir(
  lines: VisibleLine[],
  cursorIndex: number,
): VisibleLine | null {
  const targetDepth = lines[cursorIndex].node.depth - 1;
  if (targetDepth < 0) return null;
  for (let i = cursorIndex - 1; i >= 0; i--) {
    if (
      lines[i].node.type === 'directory' &&
      lines[i].node.depth === targetDepth
    ) {
      return lines[i];
    }
  }
  return null;
}

// ── Expand ancestor directories ──

function expandAncestorDirectories(
  nodes: FileTreeNode[],
  targetPath: string,
): void {
  for (const node of nodes) {
    if (node.type === 'directory') {
      if (targetPath.startsWith(node.path + '/') || targetPath === node.path) {
        node.expanded = true;
        expandAncestorDirectories(node.children, targetPath);
        return;
      }
    }
  }
}

// ── Render ──

/**
 * Build a single line for rendering (without cursor highlight).
 */
function buildLine(node: FileTreeNode, highlighted: boolean): string {
  if (node.type === 'directory') {
    return buildDirectoryLine(node, highlighted);
  }
  return buildFileLine(node, highlighted);
}

function buildDirectoryLine(node: FileTreeNode, highlighted: boolean): string {
  const indent = '  '.repeat(node.depth + 1);

  // Tri-state checkbox
  const selected = countSelectedInDir(node);
  const totalSelectable = countSelectableInDir(node);
  let checkbox: string;
  if (totalSelectable === 0) {
    checkbox = ' ';
  } else if (selected === 0) {
    checkbox = '☐';
  } else if (selected >= totalSelectable) {
    checkbox = '☑';
  } else {
    checkbox = '◐';
  }

  const cnt = chalk.dim(String(node.childrenCount));
  const prefix = highlighted ? chalk.bold('> ') : '  ';
  return `${prefix}${indent}${chalk.cyan(checkbox)} ${chalk.cyan(node.name)}/  ${cnt}`;
}

function buildFileLine(node: FileTreeNode, highlighted: boolean): string {
  // Files use same indent as sibling folders: '  '.repeat(depth + 1)
  const indent = '  '.repeat(node.depth + 1);
  const bullet = node.selected ? chalk.green('☑') : '☐';
  const title = node.name;
  const statusColor = STATUS_COLORS[node.statusLabel] || chalk.white;
  const status = statusColor(node.statusLabel);
  const tag = node.disabled ? ' (unavailable)' : '';

  const prefix = highlighted ? chalk.bold('> ') : '  ';
  const line = `${prefix}${indent}${bullet} ${title}  ${status}${tag}`;
  return node.disabled ? chalk.dim(line) : line;
}

function render(
  lines: VisibleLine[],
  cursorIndex: number,
  tree: FileTreeNode[],
  mode: SelectMode,
  prevLineCount: number,
  scrollOffset: number,
): { lineCount: number; scrollOffset: number } {
  if (prevLineCount > 0) {
    process.stdout.write(`\x1b[${prevLineCount}A`);
    process.stdout.write('\x1b[0J');
  }

  const termHeight = process.stdout.rows || 24;
  const selectedCount = countSelectedAll(tree);
  let lineCount = 0;

  // Prompt
  const color = MODE_COLORS[mode];
  const msg = MODE_MESSAGES[mode];
  process.stdout.write('\n' + color.bold(`? ${msg}`) + '\n\n');
  lineCount += 3;

  // Viewport: keep cursor visible within terminal
  const reservedBottom = 4;
  const maxVisible = Math.max(8, termHeight - lineCount - reservedBottom);

  if (cursorIndex < scrollOffset) {
    scrollOffset = cursorIndex;
  } else if (cursorIndex >= scrollOffset + maxVisible) {
    scrollOffset = cursorIndex - maxVisible + 1;
  }

  const endIndex = Math.min(lines.length, scrollOffset + maxVisible);

  // Tree (viewport)
  for (let i = scrollOffset; i < endIndex; i++) {
    const { node } = lines[i];
    const isCursor = i === cursorIndex;
    const content = buildLine(node, isCursor);
    process.stdout.write(content + '\n');
    lineCount++;
  }

  process.stdout.write('\n');
  lineCount++;

  // Bottom bar
  const more =
    lines.length > maxVisible
      ? chalk.dim(`  ${scrollOffset + 1}-${endIndex}/${lines.length}`)
      : '';
  const bar = `  ${selectedCount} selected · space toggle · ←→ collapse/expand · ↑↓ move · enter confirm · q quit${more}`;
  process.stdout.write(chalk.dim(bar) + '\n');
  lineCount++;

  return { lineCount, scrollOffset };
}

// ── Main selector ──

export function selectFromFileTree(
  entries: ArticleEntry[],
  mode: SelectMode,
): Promise<ArticleEntry[]> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      console.log('终端不支持交互模式。请直接指定文件路径。');
      resolve([]);
      return;
    }

    const tree = buildFileTree(entries, mode);

    if (!hasSelectableFile(tree)) {
      const msgs: Record<SelectMode, string[]> = {
        publish: [
          '没有可发布的文章。',
          '使用 blog draft <文件> 将文章标记为草稿后再发布。',
        ],
        unpublish: ['没有已发布的文章可供下架。'],
        draft: [
          '没有可标记为草稿的文章。',
          '所有文章已经是草稿或已发布状态。',
        ],
        idea: [
          '没有可标记为想法的文章。',
          '所有文章已经是想法或已发布状态。',
        ],
      };
      for (const line of msgs[mode]) console.log(line);
      resolve([]);
      return;
    }

    // Raw mode
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    let cursorIndex = 0;
    let prevLineCount = 0;
    let visibleLines = flattenVisible(tree);
    let scrollOffset = 0;

    // Start on first selectable file
    const firstSelectable = visibleLines.findIndex(
      (l) => l.node.type === 'file' && l.node.selectable,
    );
    if (firstSelectable >= 0) cursorIndex = firstSelectable;

    ({ lineCount: prevLineCount, scrollOffset } = render(
      visibleLines,
      cursorIndex,
      tree,
      mode,
      prevLineCount,
      scrollOffset,
    ));

    function fullRedraw(): void {
      visibleLines = flattenVisible(tree);
      if (cursorIndex >= visibleLines.length)
        cursorIndex = Math.max(0, visibleLines.length - 1);
      if (cursorIndex < 0) cursorIndex = 0;
      ({ lineCount: prevLineCount, scrollOffset } = render(
        visibleLines,
        cursorIndex,
        tree,
        mode,
        prevLineCount,
        scrollOffset,
      ));
    }

    function cleanup(): void {
      stdin.removeListener('data', onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw);
      stdin.pause();
    }

    function onData(data: Buffer): void {
      const key = data.toString();

      // ── Arrow Up / k ──
      if (key === '\x1b[A' || key === 'k') {
        if (cursorIndex > 0) cursorIndex--;
        fullRedraw();
      }
      // ── Arrow Down / j ──
      else if (key === '\x1b[B' || key === 'j') {
        if (cursorIndex < visibleLines.length - 1) cursorIndex++;
        fullRedraw();
      }
      // ── Arrow Left: collapse nearest ancestor ──
      else if (key === '\x1b[D') {
        const curNode = visibleLines[cursorIndex]?.node;
        if (!curNode) return;

        // If focused on an expanded directory, collapse it directly
        if (curNode.type === 'directory' && curNode.expanded) {
          curNode.expanded = false;
          fullRedraw();
        } else {
          // Otherwise, find and collapse the parent directory
          const parent = findParentDir(visibleLines, cursorIndex);
          if (parent) {
            parent.node.expanded = false;
            // Move cursor to the now-collapsed parent
            const newLines = flattenVisible(tree);
            const newIdx = newLines.findIndex((l) => l.node === parent.node);
            cursorIndex = newIdx >= 0 ? newIdx : 0;
            visibleLines = newLines;
            ({ lineCount: prevLineCount, scrollOffset } = render(
              visibleLines,
              cursorIndex,
              tree,
              mode,
              prevLineCount,
              scrollOffset,
            ));
          }
        }
      }
      // ── Arrow Right: expand current directory ──
      else if (key === '\x1b[C') {
        const curNode = visibleLines[cursorIndex]?.node;
        if (!curNode) return;

        if (curNode.type === 'directory' && !curNode.expanded) {
          curNode.expanded = true;
          fullRedraw();
        }
        // If file: ignored
      }
      // ── Space: toggle selection ──
      else if (key === ' ') {
        const node = visibleLines[cursorIndex]?.node;
        if (!node) return;

        if (node.type === 'directory') {
          // Toggle select all / deselect all for this directory
          const selCount = countSelectedInDir(node);
          if (selCount > 0) {
            deselectAllInDir(node);
          } else {
            selectAllInDir(node);
            node.expanded = true;
          }
        } else if (node.type === 'file' && node.selectable) {
          node.selected = !node.selected;
          if (node.selected) {
            expandAncestorDirectories(tree, node.path);
          }
        }
        fullRedraw();
      }
      // ── Enter: confirm ──
      else if (key === '\r' || key === '\n') {
        cleanup();
        resolve(collectSelected(tree));
      }
      // ── Escape / q / Ctrl+D: cancel ──
      else if (key === '\x1b' || key === 'q' || key === '\x04') {
        cleanup();
        resolve([]);
      }
      // ── Ctrl+C: hard exit ──
      else if (key === '\x03') {
        cleanup();
        process.exit(0);
      }
    }

    stdin.on('data', onData);
  });
}
