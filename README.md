# lazycursor-ai

`lazycursor-ai` installs Cursor Agent commands and routing rules inspired by
`lazycodex-ai`. It is designed for the current Cursor agent session: install it
in a workspace, then run `/ulw`, `/ultrawork`, or bare `ulw ...` prompts inside
Cursor.

## English

### Install

From a Cursor workspace root:

```bash
npx lazycursor-ai install
```

The package exposes both `lazycursor` and `lazycursor-ai` binaries.

### Use in Cursor Agent

```text
/ulw fix failing tests
/ultrawork refactor the auth flow
ulw investigate this bug
ultrawork ship this feature with tests
```

`lazycursor install` writes:

- `.cursor/commands/ulw.md`
- `.cursor/commands/ultrawork.md`
- `.cursor/rules/lazycursor-ultrawork.mdc`
- `.cursor/hooks/lazycursor.mjs`
- `.cursor/hooks.json` entries for `beforeSubmitPrompt` and `stop`
- `.cursor/lazycursor/state.json`
- an `AGENTS.md` managed block that preserves existing project instructions

After installing, restart the current Cursor Agent session so commands, rules,
and hooks are reloaded.

The JSON state hook activates on `/ulw`, `/ultrawork`, bare `ulw ...`, or bare
`ultrawork ...`. While `.cursor/lazycursor/state.json` is active, the `stop`
hook returns a follow-up message if workflow obligations are still pending.
Obligations use `status: "pending"` until complete and `status: "done"` after
evidence exists.

### Optional headless examples

```bash
npx lazycursor-ai --dry-run "fix failing tests"
npx lazycursor-ai ask "explain this repository"
npx lazycursor-ai plan "migrate the auth flow"
npx lazycursor-ai -- --version
```

## 한국어

### 설치

Cursor 워크스페이스 루트에서 실행합니다.

```bash
npx lazycursor-ai install
```

이 패키지는 `lazycursor`와 `lazycursor-ai` 실행 파일을 모두 제공합니다.

### Cursor Agent에서 사용

```text
/ulw 실패하는 테스트 수정해
/ultrawork 인증 흐름 리팩터링해
ulw 이 버그 조사해
ultrawork 테스트 포함해서 기능 배포해
```

`lazycursor install`은 Cursor 명령, rule, 그리고 기존 내용을 보존하는
`AGENTS.md` managed block을 설치합니다. 또한 `.cursor/hooks/lazycursor.mjs`,
`.cursor/hooks.json`, `.cursor/lazycursor/state.json`을 추가해 JSON state와
`stop` hook 기반 continuation을 활성화합니다.

설치 후에는 현재 Cursor Agent 세션을 종료하고 같은 workspace에서 새로 여는 것이
가장 확실합니다. JSON state가 `active: true`인 동안 미완료 obligation이 있으면
`stop` hook이 follow-up 메시지를 반환해 계속 진행하도록 유도합니다. obligation
상태값은 완료 전 `pending`, 증거 확인 후 `done`을 사용합니다.

## 日本語

### インストール

Cursor のワークスペースルートで実行します。

```bash
npx lazycursor-ai install
```

このパッケージは `lazycursor` と `lazycursor-ai` の両方のコマンドを提供します。

### Cursor Agent で使う

```text
/ulw failing tests を修正して
/ultrawork auth flow をリファクタして
ulw このバグを調査して
ultrawork テスト付きで機能を実装して
```

`lazycursor install` は Cursor の command/rule と、既存の指示を保持する
`AGENTS.md` managed block を追加します。さらに `.cursor/hooks/lazycursor.mjs`,
`.cursor/hooks.json`, `.cursor/lazycursor/state.json` を追加し、JSON state と
`stop` hook による continuation を有効にします。

インストール後は、現在の Cursor Agent セッションを終了し、同じ workspace で
新しいセッションを開始してください。JSON state が `active: true` の間は、
未完了の obligation があると `stop` hook が follow-up message を返します。
obligation の状態値は、完了前は `pending`、証拠確認後は `done` を使います。

## 中文

### 安装

在 Cursor 工作区根目录运行：

```bash
npx lazycursor-ai install
```

该包同时提供 `lazycursor` 和 `lazycursor-ai` 两个命令。

### 在 Cursor Agent 中使用

```text
/ulw fix failing tests
/ultrawork refactor the auth flow
ulw investigate this bug
ultrawork ship this feature with tests
```

`lazycursor install` 会写入 Cursor command/rule，并在 `AGENTS.md` 中加入一个
保留现有项目指令的 managed block。它还会添加
`.cursor/hooks/lazycursor.mjs`、`.cursor/hooks.json` 和
`.cursor/lazycursor/state.json`，启用 JSON state 与 `stop` hook continuation。

安装后请重启当前 Cursor Agent session，并在同一个 workspace 中重新打开。
当 JSON state 为 `active: true` 且还有 pending obligation 时，`stop` hook 会返回
follow-up message，要求 agent 继续完成流程。obligation 状态值在完成前使用
`pending`，有证据确认后使用 `done`。

## Commands

- `lazycursor install [--target <workspace>]`: install Cursor commands, rules,
  hooks, JSON state, and AGENTS routing.
- `lazycursor <task...>`: optional headless runner using `cursor-agent --print`.
- `lazycursor run <task...>`: explicit form of the default task runner.
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
