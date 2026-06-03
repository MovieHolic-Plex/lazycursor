# lazycursor-ai

`lazycursor-ai` is a small Cursor Agent wrapper and workspace installer inspired
by `lazycodex-ai`.

Hard enforcement runs through the `lazycursor` wrapper. The wrapper starts
Cursor Agent in headless mode, activates `.cursor/lazycursor/state.json`, and
keeps sending a follow-up prompt while ultrawork obligations remain pending.

Cursor Agent TUI usage is still supported as soft routing through installed
commands, rules, and `AGENTS.md`. Current Cursor CLI/TUI builds may not dispatch
project hooks, so TUI-only `/ulw` or bare `ulw` should not be treated as hard
JSON state enforcement.

## English

### Install Workspace Helpers

From a Cursor workspace root:

```bash
npx lazycursor-ai install
```

The package exposes both `lazycursor` and `lazycursor-ai` binaries.

### Hard-Enforced Wrapper Usage

Run the task through the wrapper:

```bash
npx lazycursor-ai ulw "fix failing tests"
npx lazycursor-ai ultrawork "refactor the auth flow"
npx lazycursor-ai "ship this feature with tests"
```

During those runs, lazycursor writes:

- `.cursor/lazycursor/state.json`
- `.cursor/lazycursor/events.jsonl`

The default obligations are `plan`, `implementation`, `verification`, and
`report`. Each obligation starts as `pending` and must become `done` before the
wrapper allows the workflow to finish. If obligations remain pending after a
Cursor Agent run, the wrapper sends a `LAZYCURSOR STOP WRAPPER` follow-up.

### Cursor Agent TUI Usage

After `lazycursor install`, restart the current Cursor Agent session and use:

```text
/ulw fix failing tests
/ultrawork refactor the auth flow
ulw investigate this bug
ultrawork ship this feature with tests
```

This installs:

- `.cursor/commands/ulw.md`
- `.cursor/commands/ultrawork.md`
- `.cursor/rules/lazycursor-ultrawork.mdc`
- `.cursor/hooks/lazycursor.mjs`
- `.cursor/hooks.json` entries for `beforeSubmitPrompt` and `stop`
- `.cursor/lazycursor/state.json`
- an `AGENTS.md` managed block that preserves existing project instructions

The hook files are installed as a best-effort Cursor hook surface. If your
Cursor Agent build dispatches project hooks, they can activate and block on the
same JSON state. If it does not, use the wrapper commands above for hard
enforcement.

### Other Commands

```bash
npx lazycursor-ai --dry-run "fix failing tests"
npx lazycursor-ai ask "explain this repository"
npx lazycursor-ai plan "migrate the auth flow"
npx lazycursor-ai -- --version
```

## 한국어

### 워크스페이스 설치

Cursor 워크스페이스 루트에서 실행합니다.

```bash
npx lazycursor-ai install
```

이 패키지는 `lazycursor`와 `lazycursor-ai` 실행 파일을 모두 제공합니다.

### 강제 실행 사용법

강제 JSON state와 stop-loop가 필요하면 Cursor TUI 안에서 호출하는 것이 아니라
터미널에서 래퍼로 실행합니다.

```bash
npx lazycursor-ai ulw "실패하는 테스트 수정해"
npx lazycursor-ai ultrawork "인증 흐름 리팩터링해"
npx lazycursor-ai "테스트 포함해서 기능 배포해"
```

이 경로에서는 lazycursor가 `.cursor/lazycursor/state.json`을 `active: true`로
만든 뒤 Cursor Agent를 실행합니다. 실행 후 `plan`, `implementation`,
`verification`, `report` obligation 중 하나라도 `pending`이면
`LAZYCURSOR STOP WRAPPER` follow-up을 다시 넣습니다. 모든 obligation이 `done`이
되면 state를 `active: false`, `phase: "finished"`로 닫습니다.

### Cursor Agent TUI 사용법

`lazycursor install` 후 기존 Cursor Agent 세션을 종료하고 같은 workspace에서 새로
열면 다음 입력을 soft routing으로 사용할 수 있습니다.

```text
/ulw 실패하는 테스트 수정해
/ultrawork 인증 흐름 리팩터링해
ulw 이 버그 조사해
ultrawork 테스트 포함해서 기능 배포해
```

설치되는 파일은 Cursor command, rule, `AGENTS.md` managed block, hook script,
hook config, 초기 state 파일입니다. 다만 현재 Cursor Agent CLI/TUI 빌드에서는
프로젝트 hook이 호출되지 않을 수 있습니다. 이 경우 TUI 내부 `ulw`는 안내와 routing
수준이고, 강제성은 위의 `lazycursor ulw ...` 래퍼 경로에서 보장됩니다.

## 日本語

### ワークスペースへのインストール

Cursor のワークスペースルートで実行します。

```bash
npx lazycursor-ai install
```

このパッケージは `lazycursor` と `lazycursor-ai` の両方のコマンドを提供します。

### 強制付きラッパーの使い方

JSON state と stop-loop の強制が必要な場合は、TUI 内ではなくラッパーから実行します。

```bash
npx lazycursor-ai ulw "failing tests を修正して"
npx lazycursor-ai ultrawork "auth flow をリファクタして"
npx lazycursor-ai "テスト付きで機能を実装して"
```

この経路では `.cursor/lazycursor/state.json` が active になり、`plan`,
`implementation`, `verification`, `report` がすべて `done` になるまで
`LAZYCURSOR STOP WRAPPER` follow-up が送られます。

### Cursor Agent TUI での使い方

`lazycursor install` の後、現在の Cursor Agent session を再起動すると、TUI 内で
次の soft routing を使えます。

```text
/ulw failing tests を修正して
/ultrawork auth flow をリファクタして
ulw このバグを調査して
ultrawork テスト付きで機能を実装して
```

現在の Cursor Agent CLI/TUI build では project hook が dispatch されない場合が
あります。その場合、TUI の `ulw` は routing であり、強制実行は
`lazycursor ulw ...` ラッパー経由で行います。

## 中文

### 安装工作区辅助文件

在 Cursor 工作区根目录运行：

```bash
npx lazycursor-ai install
```

该包同时提供 `lazycursor` 和 `lazycursor-ai` 两个命令。

### 强制执行用法

如果需要 JSON state 和 stop-loop 强制执行，请通过 wrapper 运行，而不是只在 TUI
内部输入命令。

```bash
npx lazycursor-ai ulw "fix failing tests"
npx lazycursor-ai ultrawork "refactor the auth flow"
npx lazycursor-ai "ship this feature with tests"
```

该路径会激活 `.cursor/lazycursor/state.json`。只要 `plan`,
`implementation`, `verification`, `report` 中还有 `pending` obligation，wrapper
就会再次发送 `LAZYCURSOR STOP WRAPPER` follow-up。全部变成 `done` 后，state 会被
关闭为 `active: false` 和 `phase: "finished"`。

### Cursor Agent TUI 用法

运行 `lazycursor install` 后，重启当前 Cursor Agent session，并在同一 workspace
中使用：

```text
/ulw fix failing tests
/ultrawork refactor the auth flow
ulw investigate this bug
ultrawork ship this feature with tests
```

TUI 用法依赖安装的 command、rule、`AGENTS.md` managed block 和 best-effort hook。
如果当前 Cursor Agent build 不 dispatch project hooks，TUI 中的 `ulw` 只是 soft
routing。需要强制执行时请使用 `lazycursor ulw ...` wrapper。

## Commands

- `lazycursor install [--target <workspace>]`: install Cursor commands, rules,
  best-effort hooks, JSON state, and AGENTS routing.
- `lazycursor <task...>`: hard-enforced headless ultrawork runner.
- `lazycursor run <task...>`: explicit form of the default task runner.
- `lazycursor ulw <task...>`: hard-enforced ultrawork runner.
- `lazycursor ultrawork <task...>`: hard-enforced ultrawork runner.
- `lazycursor ask <question...>`: run Cursor Agent in read-only ask mode.
- `lazycursor plan <task...>`: run Cursor Agent in read-only plan mode.
- `lazycursor -- <args...>`: pass raw arguments directly to `cursor-agent`.

## Requirements

Install Cursor Agent first and confirm:

```bash
cursor-agent --version
```

## Repository

Public GitHub repository:
<https://github.com/MovieHolic-Plex/lazycursor>
