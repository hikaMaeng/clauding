로컬 또는 자체 호스팅한 Anthropic 호환 Messages API로 Claude Code를 실행하는 런처입니다.

# Clauding

**익숙한 Claude Code 작업 방식으로, 직접 선택한 모델 서버에 연결하세요.**

[English](README.md) · [VS Code 연동법](#공식-vs-code-채팅창에서-사용하기) · [설정 전체 보기](docs/api.md) · [문제 해결](docs/usage.md#troubleshooting)

Clauding은 이미 설치된 Claude Code를 원하는 서버와 모델로 실행합니다. 연결 정보를 한 번 저장하면 어느 프로젝트에서든 `clauding`으로 시작할 수 있습니다. 여러 모델과 서버를 한 파일에 등록하고 실행할 때 선택하거나, Clauding 세션에 사용할 MCP 도구를 추가할 수도 있습니다.

```sh
clauding                       # 현재 폴더에서 시작
clauding "./my project"        # 지정한 폴더에서 시작
clauding --select-model 2      # 두 번째 연결 설정으로 바로 시작
```

## 어떤 점이 편리한가요?

| 기능 | 사용할 수 있는 방식 |
| --- | --- |
| 전역 `clauding` 명령 | 어느 폴더에서든 시작하고, 공백이 들어간 프로젝트 경로도 지정합니다. |
| JSON 하나로 연결 관리 | `~/.clauding/config.json`에서 서버 주소, 모델명, 선택적인 인증 토큰과 컨텍스트 크기를 수정합니다. |
| 여러 모델과 서버 등록 | 같은 형식의 설정을 `models` 배열에 넣고 메뉴·번호·모델명으로 선택합니다. |
| Clauding 실행용 MCP 추가 | `~/.clauding/mcp.json`을 통해 기존 Claude Code MCP 설정에 도구를 더합니다. |
| 공식 VS Code 채팅창 연동 | `clauding /vscode`로 기존 Anthropic 확장 안에 ON/OFF 컨트롤을 추가합니다. Anthropic 로그인 없이도 Clauding을 사용할 수 있습니다. |
| 기존 Claude Code 작업 환경 활용 | 프로젝트 지침, 설치된 스킬, 도구, 권한 설정은 Claude Code의 로딩 규칙에 따라 사용합니다. |
| 연결 주소 충돌 확인 | 검사 대상 환경변수나 로컬 설정에 다른 서버 주소가 있으면 실행 전에 원인을 알리고 중단합니다. |
| 실행한 프로세스에만 연결 설정 적용 | 셸 프로필이나 Claude 설정을 다시 쓰지 않고 자식 Claude Code 프로세스에 연결 정보를 전달합니다. |
| 작은 npm 패키지 | Node.js 22 이상에서 동작하며 런타임 npm 의존성이 없습니다. Claude Code와 모델·MCP 서버는 별도로 준비합니다. |

예를 들어 작업 PC의 모델과 다른 컴퓨터의 모델 서버를 각각 등록해 두고, 프로젝트를 시작할 때 골라 쓸 수 있습니다. Clauding은 연결을 선택하고, Claude Code는 코딩 작업을 진행하며, 모델 서버는 추론을 담당합니다.

## 준비물

1. **Node.js 22 이상과 npm**
2. **사용할 화면에 맞는 Claude Code**. 터미널에서 쓸 때는 공식 CLI를 설치하고 `claude --version`으로 확인합니다. VS Code 채팅 연동은 공식 확장에 포함된 실행 파일을 사용합니다. [Claude Code CLI 설치](https://code.claude.com/docs/en/setup)
3. **실행 중인 Anthropic 호환 Messages API 서버와 모델**: [LM Studio](https://lmstudio.ai/docs/integrations/claude-code)나 호환 게이트웨이를 사용할 수 있습니다.
4. **이 저장소에 접근할 수 있는 Git**: 아래 npm 설치 명령에서 사용합니다.

서버는 `POST /v1/messages`를 지원해야 합니다. OpenAI Chat Completions API만 제공한다면 호환 어댑터나 게이트웨이가 필요합니다. 파일 수정과 명령 실행 같은 코딩 작업에는 모델과 서버의 도구 호출 지원도 중요합니다.

## 설치하고 시작하기

### 1. 런처 설치

```sh
npm install --global "git+https://github.com/hikaMaeng/clauding.git#main"
clauding --help
```

이 명령은 Clauding 런처를 설치합니다. Claude Code 설치와 모델 서버 실행은 별도로 진행하세요.

### 2. 연결 정보 저장

아래 `my-local-model`을 서버에서 제공하는 실제 모델 ID로 바꿔 실행합니다.

```sh
clauding --init http://127.0.0.1:1234 my-local-model
```

설정은 `~/.clauding/config.json`에 저장됩니다. Windows에서는 `%USERPROFILE%\.clauding\config.json`입니다. 이미 파일이 있으면 `--init`은 그대로 보존하므로, 이후 변경은 파일을 직접 편집하면 됩니다.

주소는 `/v1/messages` 앞의 기본 URL을 사용하세요. 위 예시는 `http://127.0.0.1:1234`입니다. 다른 컴퓨터에서 추론한다면 해당 서버의 주소와 포트를 지정합니다.

### 3. 프로젝트에서 실행

```sh
clauding
clauding "./my project"
```

Windows 경로도 지정할 수 있습니다.

```powershell
clauding "F:\dev\my project"
```

시작 화면과 `/status`에서 모델을 확인하고 짧은 프롬프트를 보내 보세요. 연결 설정을 변경한 뒤에는 새 세션을 실행합니다.

## 단일 모델 설정

```json
{
  "baseUrl": "http://127.0.0.1:1234",
  "model": "my-local-model",
  "contextTokens": 65536
}
```

| 항목 | 필수 여부 | 의미 |
| --- | --- | --- |
| `baseUrl` | 필수 | Messages API의 HTTP(S) 기본 URL |
| `model` | 필수 | 서버가 받아들이는 모델 ID |
| `contextTokens` | 선택 | Claude Code가 추정에 사용할 컨텍스트 크기. 실제 서버 설정과 맞추는 양의 정수 |
| `authToken` | 선택 | 인증이 필요한 서버의 Bearer 토큰. 생략하면 `lmstudio` 사용 |

`contextTokens`를 늘려도 서버의 실제 컨텍스트 용량이 커지지는 않습니다. 인증 토큰은 로컬 JSON에 저장되므로 실제 키가 들어간 설정을 프로젝트에 커밋하지 마세요.

## 여러 모델을 선택해서 사용하기

기존 설정 객체를 그대로 `models` 배열에 넣습니다.

```json
{
  "models": [
    {
      "baseUrl": "http://127.0.0.1:1234",
      "model": "model-a",
      "contextTokens": 65536
    },
    {
      "baseUrl": "http://127.0.0.1:5678",
      "model": "model-b",
      "contextTokens": 131072,
      "authToken": "replace-with-your-server-token"
    }
  ]
}
```

여러 항목이 있으면 `clauding` 실행 시 번호 메뉴가 나타납니다. Enter만 누르면 첫 번째 항목을 선택합니다. 다음과 같이 바로 지정할 수도 있습니다.

```sh
clauding --select-model 2
clauding --select-model model-a "./my project"
```

번호는 **1부터 시작**합니다. 같은 모델 ID가 여러 번 등장하면 번호로 구분하세요. 선택은 실행할 때 적용되며 JSON은 변경하지 않습니다. 다른 연결로 바꾸려면 Clauding을 다시 실행합니다. 스크립트 등 비대화 실행에서는 여러 모델 중 하나를 `--select-model`로 명시해야 합니다.

## MCP로 도구 추가하기

웹 검색 같은 외부 도구를 연결하려면 `~/.clauding/mcp.json`에 표준 MCP 설정을 작성합니다. Clauding은 실행할 때 이 파일을 Claude Code에 전달합니다.

예를 들어 별도로 설치한 Python `websearch` 서버가 Codex 실행파일을 사용하는 경우입니다. 두 실행파일 경로는 실제 설치 위치로 바꿔 주세요.

```json
{
  "mcpServers": {
    "websearch": {
      "command": "C:/path/to/venv/Scripts/python.exe",
      "args": ["-m", "websearch"],
      "env": {
        "CODEX_MCP_CODEX_BIN": "C:/path/to/codex.exe"
      }
    }
  }
}
```

Claude Code에서 `/mcp`를 실행하면 연결 상태를 확인할 수 있습니다. 이 예시의 Python 모듈과 의존성은 별도 설치가 필요합니다. 모델을 지정하는 것만으로 웹 검색 서비스가 생기지는 않습니다.

이 추가 파일은 Clauding으로 실행한 세션에 전달되며, 일반 `claude` 실행에는 이 런처를 통해 전달되지 않습니다. 기존 Claude Code의 사용자·프로젝트 MCP 설정도 함께 적용됩니다. 제공한 파일만 사용하려면 [MCP 설정과 범위](docs/usage.md#add-mcp-tools)를 참고하세요.

## 공식 VS Code 채팅창에서 사용하기

Clauding을 등록하면 Anthropic의 공식 Claude Code 채팅창에 연결 전환 버튼이 생깁니다. 같은 채팅창에서 기존 Claude 연결과 직접 설정한 모델 서버를 오갈 수 있습니다. 이 버튼과 채팅 명령은 Clauding에 포함된 Claude Code Mod가 제공합니다.

### 1. 확장과 런처 설치하기

1. VS Code의 **Extensions(확장)**에서 Anthropic이 게시한 **Claude Code for VS Code**를 설치합니다. 확장 ID는 `anthropic.claude-code`입니다. 기본 프로필의 로컬 VS Code 창을 사용하세요. 이 연동은 Windows에서 공식 확장 `2.1.327`로 확인했습니다. [공식 확장 설치 페이지](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
2. Node.js 22 이상이 있는 터미널에서 Clauding을 설치하거나 업데이트합니다. 연동을 사용하는 동안 런처를 설치해 두세요.

   ```sh
   npm install --global "git+https://github.com/hikaMaeng/clauding.git#main"
   clauding --help
   ```

   도움말에 `/vscode`가 있는지 확인합니다. Windows에서는 등록할 때 기존 .NET Framework C# 컴파일러로 실행 어댑터를 만듭니다.

### 2. 모델 서버 설정하기

모델 서버를 실행하고 사용할 모델을 불러옵니다. 터미널에서 기본 URL과 실제 모델 ID를 지정해 설정을 만듭니다.

```sh
clauding --init http://127.0.0.1:1234 my-local-model
```

Messages API의 요청 주소가 `http://127.0.0.1:1234/v1/messages`라면 기본 URL은 `http://127.0.0.1:1234`입니다. `my-local-model`은 서버가 제공하는 정확한 모델 ID로 바꿉니다. VS Code는 터미널과 같은 [단일 모델 설정](#단일-모델-설정)이나 [여러 모델 설정](#여러-모델을-선택해서-사용하기)을 읽습니다.

`--init`은 `~/.clauding/config.json`이 없을 때 파일을 만듭니다. 기존 설정을 바꾸려면 파일을 직접 편집하세요. Windows에서는 `%USERPROFILE%\.clauding\config.json`입니다. 서버가 인증을 요구하면 `authToken`을 추가하고, `contextTokens`는 서버에 실제로 설정한 컨텍스트 크기에 맞춥니다.

### 3. VS Code에 등록하기

일반 터미널이나 VS Code의 통합 터미널에서 한 번 실행합니다.

```sh
clauding /vscode
```

성공하면 선택된 모델명, VS Code 설정 파일 경로, 백업 폴더가 출력됩니다. 기본 프로필의 사용자 설정에 `claudeCode.claudeProcessWrapper`와 `claudeCode.disableLoginPrompt`가 등록됩니다. Windows 설정 파일은 `%APPDATA%\Code\User\settings.json`이고, 백업은 `~/.clauding/vscode/backups/`에 저장됩니다. [공식 확장 설정 설명](https://code.claude.com/docs/en/vs-code#extension-settings)

VS Code 명령 팔레트에서 **Developer: Reload Window**를 실행합니다. 왼쪽 활동 표시줄에서 **Claude Code**를 열고 **새 채팅**을 시작하세요. 터미널이 열리면 VS Code 설정에서 **Claude Code: Use Terminal**을 꺼서 그래픽 채팅창을 사용합니다.

### 4. 모드를 전환하고 응답 확인하기

채팅 입력창 위의 **Clauding** 버튼에 현재 모드가 표시됩니다. 답변이 끝난 뒤 버튼을 눌러 전환할 수 있습니다.

| 모드 | 다음 모델 요청이 전달되는 곳 |
| --- | --- |
| **Clauding OFF** | 공식 확장에서 선택한 Claude 모델과 기존 연결을 사용합니다. 로그인한 세션은 이 모드에서 시작합니다. |
| **Clauding ON** | 현재 선택한 Clauding 항목의 URL, 토큰, 모델 ID, 컨텍스트 설정을 사용합니다. 로그아웃 상태가 확인되면 이 모드로 시작합니다. |

채팅에 `/clauding`을 입력하면 컨트롤을 열 수 있습니다. `/clauding on`과 `/clauding off`는 모델을 호출하지 않고 연결을 전환합니다. **ON**일 때는 Clauding 버튼 옆에 표시된 모델 ID가 실제 요청에 사용됩니다. 공식 확장의 기존 Claude 모델 메뉴는 **OFF** 연결에 적용됩니다.

처음에는 **Clauding ON**을 확인한 뒤 `VSCODE_CLAUDING_OK라고만 답해줘.` 같은 짧은 메시지를 보내 보세요. 서버 요청 로그를 볼 수 있다면 선택한 모델 ID로 Messages 요청이 들어왔는지도 확인합니다. 기존 Claude 연결을 사용할 수 있다면 응답이 끝난 뒤 **OFF**로 돌아갈 수 있습니다.

전환 뒤 다음 요청에 이전 대화 내용이 포함될 수 있습니다. 서버별로 대화 내용을 분리하려면 새 채팅을 사용하세요. 프로젝트 권한은 공식 확장 설정을 따릅니다. `~/.clauding/mcp.json`이 있으면 채팅 시작 시 함께 불러오며, 등록한 MCP 도구는 두 모드에서 모두 표시됩니다.

### 5. 모델이나 서버 바꾸기

설정에 모델이 여러 개 있으면 채팅창의 **Clauding model** 선택기에서 고릅니다. 처음에는 첫 번째 모델을 사용하며, 새 채팅의 기본 모델을 저장하려면 번호나 고유 모델 ID를 지정합니다.

```sh
clauding /vscode --select-model 2
clauding /vscode --select-model my-local-model
```

번호는 1부터 시작합니다. 기본 선택은 `~/.clauding/vscode.json`의 `modelSelector`에 저장됩니다. 주소, 토큰, 모델 ID, 컨텍스트는 `config.json`에서 수정하고 새 채팅을 열면 적용됩니다. **ON**으로 전환할 때도 모델 설정을 다시 읽습니다. 저장해 둔 모델을 설정에서 삭제했다면 유효한 항목으로 다시 등록하세요.

### VS Code 연동 문제 해결

| 증상 | 확인할 내용 |
| --- | --- |
| `/vscode`를 폴더로 해석하거나 도움말에 표시되지 않음 | Clauding을 업데이트합니다. Windows에서는 `Get-Command clauding -All`로 예전 PowerShell 스크립트가 npm 런처보다 먼저 실행되는지 확인하세요. |
| VS Code의 `settings.json`을 읽지 못함 | 자동 등록은 표준 JSON 형식을 요구합니다. 사용자 설정을 백업한 뒤 주석과 마지막 항목 뒤의 쉼표를 정리하고 다시 등록합니다. |
| 버튼이 보이지 않음 | 공식 확장과 기본 로컬 프로필을 확인합니다. **Claude Code: Use Terminal**을 끄고 창을 다시 불러온 다음, 새 채팅에서 `/clauding`을 입력합니다. 확장이나 조직 정책이 Mod를 제한할 수도 있습니다. |
| 로그인 화면이 나오거나 계정 확인이 지연됨 | **Continue without Signing In**이 표시되면 선택한 뒤 새 채팅에서 ON 상태를 확인합니다. 계정 확인 실패 안내가 나오면 **Clauding ON**을 직접 선택합니다. 실제로 사용 중인 프로필에 등록 명령이 출력한 두 설정이 적용되었는지도 확인하세요. |
| **ON**인데 답변이 오지 않음 | VS Code가 실행 중인 컴퓨터에서 서버에 접근할 수 있는지, `POST /v1/messages`가 토큰을 허용하는지, 버튼 옆의 모델 ID가 서버에 등록된 값인지 확인합니다. |

자동 등록은 기본 데스크톱 VS Code 프로필을 대상으로 합니다. 다른 프로필, 포터블 설치, Cursor, 원격 확장 호스트는 자동 등록 범위 밖입니다.

### 연동 해제하기

```sh
clauding /vscode --off
```

등록할 때 바꾼 VS Code 설정 두 개를 이전 값으로 복원합니다. 등록 뒤 해당 값을 직접 수정했다면 명령이 충돌을 알리므로, 남겨 둔 백업을 참고해 복원하세요. 해제 뒤에는 VS Code 창을 다시 불러옵니다. 잠시 연결을 바꾸려면 채팅의 **OFF** 버튼을 사용하면 됩니다. [상세 설정과 복원 방식](docs/vscode.md)

## 기존 Claude Code 옵션 사용하기

폴더를 지정한 뒤 `--` 다음에 Claude Code 옵션을 넣습니다. 대화창 대신 짧은 요청을 실행하려면 `-p`를 사용하세요.

```sh
clauding -- -p "이 프로젝트의 구조를 요약해 줘"
clauding "./my project" -- -p "테스트 실행 방법을 설명해 줘"
clauding --select-model 2 -- -p "주요 진입점을 설명해 줘"
```

처음 나오는 일반 문자열은 폴더로 해석되므로 프롬프트에는 `-p`를 붙여 주세요. 권한 정책은 Claude Code의 설정과 전달한 옵션을 따릅니다. 이 패키지가 기본으로 권한 무시 모드를 켜지는 않습니다.

| 명령 | 동작 |
| --- | --- |
| `clauding --init [base-url model-id]` | 설정 파일이 없을 때 생성 |
| `clauding [folder]` | 현재 또는 지정 폴더에서 대화형 실행 |
| `clauding --select-model <index\|model-id> [folder]` | 저장된 연결 선택 후 실행 |
| `clauding /vscode [--select-model <index\|model-id>]` | 공식 VS Code 채팅에 연동하고 필요하면 초기 모델을 저장 |
| `clauding /vscode --off` | VS Code 연동 해제 |
| `clauding --help` | 런처 도움말 |
| `clauding -- --help` | Claude Code 도움말 |
| `clauding -- --version` | 런처가 찾은 Claude Code 버전 확인 |

`--select-model`은 폴더와 Claude Code 옵션보다 먼저 지정합니다. [전체 명령·설정 규칙](docs/api.md)

## 자주 묻는 질문

**기존 지침이나 스킬을 이어받나요?** Claude Code가 원래의 설정·프로젝트 신뢰·권한 규칙으로 불러옵니다. Clauding은 연결 설정과 선택적인 MCP 파일을 전달합니다. 별도 스킬 설치 공간이나 별도 Claude 설정 홈을 만드는 기능은 없습니다.

**아무 모델이나 쓸 수 있나요?** 서버의 Messages API 호환성과 모델의 도구 호출 능력이 필요합니다. 스트리밍·이미지·컨텍스트 크기 등의 지원도 모델과 서버에 따라 다르므로, 새 조합은 짧은 과제로 먼저 확인하세요.

**연결 주소가 충돌한다며 실행이 멈춥니다.** 검사한 `ANTHROPIC_BASE_URL` 선언이 선택한 주소와 다르다는 뜻입니다. 오류에 표시된 설정 출처에서 충돌을 해결하세요. Clauding은 실행 전에 중단하고 해당 선언을 알립니다. [검사 범위와 한계](docs/constraints.md#endpoint-checks)

**Windows에서 Ctrl+V로 이미지가 붙지 않습니다.** Windows Terminal이 해당 단축키를 자체 처리할 수 있습니다. Claude Code의 Windows 이미지 붙여넣기는 **Alt+V**입니다. 첨부 이후 이미지를 이해하려면 모델과 서버의 이미지 지원도 필요합니다. [공식 단축키 안내](https://code.claude.com/docs/en/interactive-mode#general-controls)

접속 실패, MCP 실행 오류, 컨텍스트 경고, 예전 Windows 런처가 먼저 실행되는 문제는 [문제 해결](docs/usage.md#troubleshooting)을 참고하세요.

## 상세 문서와 개발

| 알고 싶은 내용 | 문서 |
| --- | --- |
| 목적과 각 구성요소의 역할 | [Overview](docs/overview.md) |
| 설치·설정·문제 해결 | [Usage](docs/usage.md) |
| 공식 VS Code 채팅창 연동 | [VS Code](docs/vscode.md) |
| 명령과 설정 항목 | [API](docs/api.md) |
| 실행 흐름 | [Architecture](docs/architecture.md) |
| 제공자·플랫폼 제약 | [Constraints](docs/constraints.md) |
| 실행파일 탐색과 환경변수 처리 | [Internals](docs/internals.md) |
| 테스트와 npm 패키지 검증 | [Testing](docs/testing.md) |

```sh
git clone https://github.com/hikaMaeng/clauding.git
cd clauding
npm test
npm pack --dry-run
```

자동 테스트는 격리한 홈과 가짜 Claude Code 프로세스로 런처의 동작을 확인합니다. 실제 모델 품질과 API 호환성은 별도 연동 검증이 필요합니다. [테스트 범위](docs/testing.md)

Clauding, Claude Code, 모델 제공자, MCP 서버에는 각각의 배포 조건이 적용됩니다. 패키지의 `UNLICENSED` 선언과 [Claude Code 이용 조건](https://code.claude.com/docs/en/legal-and-compliance)을 확인하세요.
