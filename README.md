# Fast Jump (C++/Proto)

A tiny VS Code extension for **huge** C++/Protobuf codebases. It does not rely on
any language server or symbol index — only on simple, deterministic path rules —
so every jump is instant no matter how large the workspace is.

## Features

### 1. Switch Header/Source — `Alt+O`

Your project keeps headers and sources in the same directory, so switching is just
an extension swap:

- `foo.cc` / `foo.cpp` → `foo.h`
- `foo.h` → `foo.cc` (falls back to `foo.cpp`)

No workspace scan; the counterpart is constructed from the current file name and
opened directly.

### 2. Go to Include/Import — `Alt+G`

With the cursor on an `#include "..."` line (C++) or an `import "...";` line
(proto), jump straight to the file, resolving the quoted path against the
**workspace root** (base_dir):

- regular headers: opened directly
- protobuf generated files (`*.pb.h`, `*.pb.cc`, `*.grpc.pb.h`, ...): redirected
  to the corresponding `.proto`

Angle-bracket includes (`#include <...>`) are intentionally ignored — they belong
to a language server's include path resolution, not to simple rules.

## Settings

```jsonc
{
  // Tried in order when switching from a header (default: ["cc", "cpp"])
  "fastJump.sourceExtensions": ["cc", "cpp"],
  // Tried in order when switching from a source (default: ["h"])
  "fastJump.headerExtensions": ["h"]
}
```

Keybindings are only active in C/C++/Proto editors and can be remapped freely
(`fastJump.switchHeaderSource`, `fastJump.gotoInclude`).

## Development

```sh
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host.
