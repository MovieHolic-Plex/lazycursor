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
- an `AGENTS.md` managed block that preserves existing project instructions

Cursor CLI does not currently expose the same hook/lifecycle surface as Codex,
so `/ulw` is the reliable command path. Bare `ulw ...` depends on Cursor reading
the installed rules.

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
`AGENTS.md` managed block을 설치합니다.

Cursor CLI는 Codex와 같은 prompt hook/lifecycle 표면을 안정적으로 제공하지
않으므로 `/ulw`가 가장 확실한 호출 방식입니다. bare `ulw ...`는 Cursor가
설치된 rule을 읽고 따르는 경우에만 동작합니다.

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
`AGENTS.md` managed block を追加します。

Cursor CLI は Codex と同等の hook/lifecycle surface をまだ提供していないため、
`/ulw` が最も確実な呼び出し方法です。bare `ulw ...` は Cursor がインストール済み
rule を読む場合にのみ安定します。

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
保留现有项目指令的 managed block。

Cursor CLI 目前没有 Codex 那种完整的 hook/lifecycle surface，因此 `/ulw` 是更可靠
的调用方式。bare `ulw ...` 取决于 Cursor 是否读取并遵守已安装的 rule。

## Commands

- `lazycursor install [--target <workspace>]`: install Cursor commands, rules,
  and AGENTS routing.
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
