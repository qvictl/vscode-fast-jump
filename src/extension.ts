import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('fastJump.switchHeaderSource', switchHeaderSource),
    vscode.commands.registerCommand('fastJump.gotoInclude', gotoInclude),
  );
}

export function deactivate(): void {
  // Nothing to clean up: this extension holds no state.
}

interface RuleConfig {
  headerExtensions: string[];
  sourceExtensions: string[];
}

function normalizeExt(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase();
}

function getConfig(): RuleConfig {
  const cfg = vscode.workspace.getConfiguration('fastJump');
  return {
    headerExtensions: (cfg.get<string[]>('headerExtensions') ?? ['h']).map(normalizeExt),
    sourceExtensions: (cfg.get<string[]>('sourceExtensions') ?? ['cc', 'cpp']).map(normalizeExt),
  };
}

async function openFile(filePath: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(doc);
}

function flash(message: string): void {
  vscode.window.setStatusBarMessage(`Fast Jump: ${message}`, 4000);
}

/**
 * Switch between header and source living in the SAME directory.
 * Pure path rewrite + existence check: no index, no search, instant
 * regardless of workspace size.
 */
async function switchHeaderSource(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const filePath = editor.document.uri.fsPath;
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) {
    return;
  }
  const ext = filePath.slice(dot + 1).toLowerCase();
  const { headerExtensions, sourceExtensions } = getConfig();

  let candidates: string[];
  if (headerExtensions.includes(ext)) {
    candidates = sourceExtensions;
  } else if (sourceExtensions.includes(ext)) {
    candidates = headerExtensions;
  } else {
    flash(`".${ext}" is neither a configured header nor source extension`);
    return;
  }

  const stem = filePath.slice(0, dot + 1);
  for (const candidateExt of candidates) {
    const candidate = stem + candidateExt;
    if (fs.existsSync(candidate)) {
      await openFile(candidate);
      return;
    }
  }
  flash(`no counterpart found (tried ${candidates.map((c) => stem + c).join(', ')})`);
}

const CPP_INCLUDE_RE = /^\s*#\s*include\s*"([^"]+)"/;
const PROTO_IMPORT_RE = /^\s*import\s+"([^"]+)"\s*;/;
// Protobuf generated files: foo.pb.h / foo.pb.cc / foo.grpc.pb.h / foo.grpc.pb.cc ...
const PB_GENERATED_RE = /(?:\.grpc)?\.pb\.(?:h|hh|hpp|hxx|cc|cpp|cxx)$/i;

/**
 * Jump to the file referenced by an #include "..." (C++) or import "..." (proto)
 * line under the cursor. The quoted path is resolved against the workspace root
 * (base_dir), not relative to the current file. Protobuf generated headers are
 * redirected to the .proto source.
 */
async function gotoInclude(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const document = editor.document;
  const line = document.lineAt(editor.selection.active.line).text;
  const isProto = document.fileName.toLowerCase().endsWith('.proto');

  const match = line.match(isProto ? PROTO_IMPORT_RE : CPP_INCLUDE_RE);
  if (!match) {
    flash(isProto ? 'cursor is not on an import "..." line' : 'cursor is not on an #include "..." line');
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const baseDir = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(document.fileName);
  let target = path.resolve(baseDir, match[1]);

  if (PB_GENERATED_RE.test(target)) {
    target = target.replace(PB_GENERATED_RE, '.proto');
  }

  if (!fs.existsSync(target)) {
    flash(`file not found: ${target}`);
    return;
  }
  await openFile(target);
}
