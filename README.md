# gas-english

Google スプレッドシート上の未学習（「済」未チェック）な英単語・英熟語をランダムに抽出し、Gemini APIで学習カード形式の文章を生成して Google Chat（Incoming Webhook）へ投稿する Google Apps Script（GAS）です。投稿成功後に対象行を「済」に更新し、実行ログをシートへ記録します。

## 処理フロー

1. `runGenerate()`（時間主導トリガー想定）を実行
2. `loadConfig()` で設定を読み取り（必須キー未設定なら停止）
3. `sampleAll()` で「英単語」「英熟語」シートから未学習行をサンプリング
4. `buildPrompt()` でプロンプトを組み立て
5. `callGemini()` で Gemini `generateContent` を呼び出し
6. `postToChat()` で Google Chat Webhook に投稿（長文は分割）
7. 投稿成功後に `markRowsAsDone()` で「済」を更新
8. `writeLog()` で「ログ」シートへ記録（エラー時も記録、済は更新しない）

## 必要なシート構成

### 英単語（シート名: `英単語`）

ヘッダ（1行目）が次の順序である必要があります。

- `済` | `No.` | `Word` | `品詞` | `重要度` | `主な意味`

### 英熟語（シート名: `英熟語`）

ヘッダ（1行目）が次の順序である必要があります。

- `済` | `No.` | `Idiom / Phrase` | `重要度` | `主な意味`

### 設定（シート名: `設定`）

`key` / `value` の2列を想定します（1行目はヘッダ扱いでスキップ）。

必須キー:

- `chatWebhookUrl`: Google Chat Incoming Webhook URL
- `geminiApiKey`: Gemini API Key
- `geminiModel`: 例: `gemini-1.5-pro` など（利用したいモデル名）

任意キー（未設定時はデフォルト）:

- `wordCount`（デフォルト: 15）
- `idiomCount`（デフォルト: 5）
- `temperature`（デフォルト: 0.7）
- `maxOutputTokens`（デフォルト: 8192）

### ログ（シート名: `ログ`）

存在しない場合、初回実行時に自動作成されます。

## トリガー設定

Apps Script エディタの「トリガー」から `runGenerate` を時間主導型で定期実行する想定です（例: 毎日朝に実行）。

## 送信フォーマット（Google Chat 向け）

- Google Chat の `text` メッセージは Markdown のサブセットのみ対応のため、プロンプト側で書式制約を強めています。
- 念のため `postToChat()` 送信前に `convertToChatMarkdown()` で `**太字**` を `*太字*` に変換し、ネスト箇条書きをフラット化します。
- 長文は `splitTextForChat()` で区切り線（`---`）を優先して分割し、上限を超える場合は改行単位で強制分割します。

## 権限（OAuth scopes）

`appsscript.json` では次のスコープを使用します。

- `https://www.googleapis.com/auth/spreadsheets.currentonly`
- `https://www.googleapis.com/auth/script.external_request`

## ファイル構成

- `appsscript.json`: GAS マニフェスト（タイムゾーン、スコープ、V8 など）
- `Main.gs`: エントリポイント `runGenerate()`、エラーハンドリング、ログ記録（`writeLog()`）
- `Config.gs`: シート名/列/ヘッダ/設定キーの定数、ヘッダ検証（`validateHeaders()`）、設定読み取り（`loadConfig()`）
- `Sheets.gs`: 未学習行抽出（`getUnfinishedRows()`）、シャッフル、サンプリング（`sampleAll()`）、済更新（`markRowsAsDone()`）
- `Prompt.gs`: Gemini に渡すプロンプト組み立て（`buildPrompt()`）
- `Gemini.gs`: Gemini API 呼び出し（`callGemini()`）とレスポンステキスト抽出
- `Chat.gs`: Google Chat Incoming Webhook 投稿（`postToChat()`）、Chat向けMarkdown変換、長文分割

