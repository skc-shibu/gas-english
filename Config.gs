/**
 * Config.gs
 * シート列仕様の定数定義・設定シート読み取り・バリデーション
 */

// ──────────────────────────────────────────────
// シート名
// ──────────────────────────────────────────────
var SHEET_NAME_WORDS = "英単語";
var SHEET_NAME_IDIOMS = "英熟語";
var SHEET_NAME_CONFIG = "設定";
var SHEET_NAME_LOG = "ログ";

// ──────────────────────────────────────────────
// 英単語シートの列定義（0-indexed）
// ヘッダ: 済 | No. | Word | 品詞 | 重要度 | 主な意味
// ──────────────────────────────────────────────
var WORD_COL = {
  DONE: 0, // 済（チェックボックス）
  NO: 1, // No.
  WORD: 2, // Word
  POS: 3, // 品詞
  IMPORTANCE: 4, // 重要度
  MEANING: 5, // 主な意味
};
var WORD_HEADERS = ["済", "No.", "Word", "品詞", "重要度", "主な意味"];

// ──────────────────────────────────────────────
// 英熟語シートの列定義（0-indexed）
// ヘッダ: 済 | No. | Idiom / Phrase | 重要度 | 主な意味
// ──────────────────────────────────────────────
var IDIOM_COL = {
  DONE: 0, // 済（チェックボックス）
  NO: 1, // No.
  PHRASE: 2, // Idiom / Phrase
  IMPORTANCE: 3, // 重要度
  MEANING: 4, // 主な意味
};
var IDIOM_HEADERS = ["済", "No.", "Idiom / Phrase", "重要度", "主な意味"];

// ──────────────────────────────────────────────
// 設定シートの key 定義
// ──────────────────────────────────────────────
var CONFIG_KEY = {
  CHAT_WEBHOOK_URL: "chatWebhookUrl",
  GEMINI_API_KEY: "geminiApiKey",
  GEMINI_MODEL: "geminiModel",
  WORD_COUNT: "wordCount",
  IDIOM_COUNT: "idiomCount",
  TEMPERATURE: "temperature",
  MAX_OUTPUT_TOKENS: "maxOutputTokens",
};

// 必須キー（未設定なら例外）
var REQUIRED_CONFIG_KEYS = [
  CONFIG_KEY.CHAT_WEBHOOK_URL,
  CONFIG_KEY.GEMINI_API_KEY,
  CONFIG_KEY.GEMINI_MODEL,
];

// デフォルト値
var CONFIG_DEFAULTS = {};
CONFIG_DEFAULTS[CONFIG_KEY.WORD_COUNT] = 15;
CONFIG_DEFAULTS[CONFIG_KEY.IDIOM_COUNT] = 5;
CONFIG_DEFAULTS[CONFIG_KEY.TEMPERATURE] = 0.7;
CONFIG_DEFAULTS[CONFIG_KEY.MAX_OUTPUT_TOKENS] = 8192;

// ──────────────────────────────────────────────
// ログシートの列定義
// ヘッダ: timestamp | wordCount | idiomCount | prompt | response | error
// ──────────────────────────────────────────────
var LOG_HEADERS = [
  "timestamp",
  "wordCount",
  "idiomCount",
  "prompt",
  "response",
  "error",
];

// ──────────────────────────────────────────────
// ヘッダ検証
// ──────────────────────────────────────────────

/**
 * 指定シートのヘッダ行が期待する列構成と一致するか検証する
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @param {string[]} expectedHeaders - 期待するヘッダ配列
 * @throws {Error} ヘッダが一致しない場合
 */
function validateHeaders(sheet, expectedHeaders) {
  var sheetName = sheet.getName();
  var lastCol = expectedHeaders.length;
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  for (var i = 0; i < expectedHeaders.length; i++) {
    var actual = String(headerRow[i]).trim();
    var expected = expectedHeaders[i];
    if (actual !== expected) {
      throw new Error(
        "「" +
          sheetName +
          "」シートのヘッダが不正です。" +
          "列" +
          (i + 1) +
          ': 期待="' +
          expected +
          '", 実際="' +
          actual +
          '"',
      );
    }
  }
}

// ──────────────────────────────────────────────
// 設定シート読み取り
// ──────────────────────────────────────────────

/**
 * 設定シートから key-value を読み取り、必須キーの存在を検証して返す
 * @returns {Object} 設定値のマップ
 * @throws {Error} シートが見つからない／必須キーが未設定の場合
 */
function loadConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_CONFIG);
  if (!sheet) {
    throw new Error(
      "「" +
        SHEET_NAME_CONFIG +
        "」シートが見つかりません。" +
        "設定シートを作成し、key / value の列を用意してください。",
    );
  }

  var data = sheet.getDataRange().getValues();
  var config = {};

  // 1行目はヘッダ（key | value）なのでスキップ
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var value = String(data[i][1]).trim();
    if (key) {
      config[key] = value;
    }
  }

  // 必須キーの検証
  var missing = [];
  for (var j = 0; j < REQUIRED_CONFIG_KEYS.length; j++) {
    var rk = REQUIRED_CONFIG_KEYS[j];
    if (!config[rk]) {
      missing.push(rk);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      "設定シートに必須項目が未設定です: " +
        missing.join(", ") +
        "\n設定シートに上記のキーと値を入力してください。",
    );
  }

  // デフォルト値の適用（数値変換込み）
  var keys = Object.keys(CONFIG_DEFAULTS);
  for (var k = 0; k < keys.length; k++) {
    var dk = keys[k];
    if (!config[dk] || config[dk] === "") {
      config[dk] = CONFIG_DEFAULTS[dk];
    } else {
      // 数値として扱うキーは変換
      var num = Number(config[dk]);
      if (!isNaN(num)) {
        config[dk] = num;
      }
    }
  }

  return config;
}
