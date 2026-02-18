/**
 * Chat.gs
 * Google Chat Incoming Webhook への投稿（長文分割対応）
 */

// Google Chat Webhook の推奨テキスト上限（バイト数ではなく文字数で安全マージン確保）
var CHAT_MAX_LENGTH = 4000;

/**
 * Google Chat Incoming Webhook へテキストを投稿する
 * 送信前に Chat 用 Markdown へ変換し、長文は自動分割する
 * @param {string} text - 投稿するテキスト
 * @param {string} webhookUrl - Webhook URL
 * @throws {Error} 投稿失敗時
 */
function postToChat(text, webhookUrl) {
  // Geminiの出力を Google Chat 用 Markdown に変換（保険）
  var converted = convertToChatMarkdown(text);
  var chunks = splitTextForChat(converted);

  for (var i = 0; i < chunks.length; i++) {
    postSingleMessage(chunks[i], webhookUrl);

    // 複数メッセージの場合、レートリミット回避のために少し待機
    if (chunks.length > 1 && i < chunks.length - 1) {
      Utilities.sleep(1000);
    }
  }
}

/**
 * テキストを Chat 投稿用に分割する
 * 水平線（---）を区切りとして分割し、上限内に収める
 * @param {string} text - 元テキスト
 * @returns {string[]} 分割されたテキストの配列
 */
function splitTextForChat(text) {
  if (text.length <= CHAT_MAX_LENGTH) {
    return [text];
  }

  // 水平線で分割を試みる
  var sections = text.split(/\n---\n/);
  var chunks = [];
  var current = '';

  for (var i = 0; i < sections.length; i++) {
    var section = sections[i];
    var separator = (i > 0) ? '\n---\n' : '';
    var candidate = current + separator + section;

    if (candidate.length > CHAT_MAX_LENGTH && current.length > 0) {
      // 現在のチャンクを確定し、新しいチャンクを開始
      chunks.push(current);
      current = section;
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    // 最後のチャンクが上限を超える場合はさらに強制分割
    if (current.length > CHAT_MAX_LENGTH) {
      var forceSplit = forceChunkText(current, CHAT_MAX_LENGTH);
      for (var j = 0; j < forceSplit.length; j++) {
        chunks.push(forceSplit[j]);
      }
    } else {
      chunks.push(current);
    }
  }

  return chunks;
}

/**
 * テキストを強制的に指定文字数以内に分割する（改行位置で切る）
 * @param {string} text
 * @param {number} maxLen
 * @returns {string[]}
 */
function forceChunkText(text, maxLen) {
  var lines = text.split('\n');
  var chunks = [];
  var current = '';

  for (var i = 0; i < lines.length; i++) {
    var candidate = current ? (current + '\n' + lines[i]) : lines[i];
    if (candidate.length > maxLen && current.length > 0) {
      chunks.push(current);
      current = lines[i];
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

// ──────────────────────────────────────────────
// Markdown 変換（標準 Markdown → Google Chat 用）
// ──────────────────────────────────────────────

/**
 * 標準 Markdown を Google Chat テキストメッセージ用の書式に変換する
 * - **bold** → *bold*（ダブルアスタリスク → シングル）
 * - ネストした箇条書き（先頭空白 + "- "）→ フラット化
 * @param {string} text
 * @returns {string} 変換後テキスト
 */
function convertToChatMarkdown(text) {
  // **...**  →  *...*
  // 非貪欲マッチで最短一致させる
  var result = text.replace(/\*\*(.+?)\*\*/g, '*$1*');

  // __...__ → *...*（アンダースコア太字もシングルアスタリスクへ）
  result = result.replace(/__(.+?)__/g, '*$1*');

  // ネストした箇条書きをフラット化: 行頭の空白 + "- " → "- "
  result = result.replace(/^[ \t]+([-*] )/gm, '$1');

  return result;
}

/**
 * 単一メッセージを Webhook へ POST する
 * @param {string} text - メッセージテキスト
 * @param {string} webhookUrl - Webhook URL
 * @throws {Error} HTTP エラー時
 */
function postSingleMessage(text, webhookUrl) {
  var payload = {
    text: text
  };

  var options = {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(webhookUrl, options);
  var statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    var body = response.getContentText();
    throw new Error(
      'Google Chat Webhook エラー (HTTP ' + statusCode + '): ' + body
    );
  }
}
