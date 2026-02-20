/**
 * Main.gs
 * エントリポイント・ログ記録・エラーハンドリング
 *
 * 【トリガー設定手順】
 * 1. Apps Script エディタ左メニューの「トリガー」（時計アイコン）を開く
 * 2. 「トリガーを追加」をクリック
 * 3. 以下を設定:
 *    - 実行する関数: runGenerate
 *    - イベントのソース: 時間主導型
 *    - 時間ベースのトリガーのタイプ: 日付ベースのタイマー（例: 毎日午前7〜8時）
 * 4. 保存
 */

// ──────────────────────────────────────────────
// メイン実行関数（時間主導トリガーから呼び出される）
// ──────────────────────────────────────────────

/**
 * メイン処理: サンプリング → Gemini生成 → Chat投稿 → 済更新 → ログ記録
 * 時間主導トリガーから定期実行される
 */
function runGenerate() {
  var config;
  var prompt = "";
  var generatedText = "";
  var errorMessage = "";
  var wordCount = 0;
  var idiomCount = 0;

  try {
    // 1. 設定読み取り
    config = loadConfig();

    // 2. 未学習行のサンプリング
    var sampled = sampleAll(config);
    wordCount = sampled.words.actual;
    idiomCount = sampled.idioms.actual;

    // 3. プロンプト組み立て
    prompt = buildPrompt(sampled.words, sampled.idioms);

    // 4. Gemini API 呼び出し
    generatedText = callGemini(prompt, config);

    // 5. 不足メッセージがあれば先頭に付与
    var chatText = generatedText;
    if (sampled.shortageMessage) {
      chatText = sampled.shortageMessage + "\n\n" + chatText;
    }

    // 6. Google Chat へ投稿
    var webhookUrl = config[CONFIG_KEY.CHAT_WEBHOOK_URL];
    postToChat(chatText, webhookUrl);

    // 7. 済チェックの更新（Chat投稿が成功した後にのみ実行）
    markRowsAsDone(SHEET_NAME_WORDS, sampled.words.rows);
    markRowsAsDone(SHEET_NAME_IDIOMS, sampled.idioms.rows);

    // 8. ログ記録
    // writeLog(wordCount, idiomCount, prompt, generatedText, '');

    // 9. 完了ログ
    Logger.log(
      "完了: 英単語 " +
        wordCount +
        "件 + 英熟語 " +
        idiomCount +
        "件 を生成し、Google Chatへ投稿しました。",
    );
  } catch (e) {
    errorMessage = e.message || String(e);
    Logger.log("runGenerate error: " + errorMessage);

    // エラー時もログを残す（済は更新しない）
    writeLog(wordCount, idiomCount, prompt, generatedText, errorMessage);

    // トリガーにエラーを伝える（GASがオーナーへ失敗通知メールを送信する）
    throw e;
  }
}

// ──────────────────────────────────────────────
// ログ記録
// ──────────────────────────────────────────────

/**
 * ログシートへ1行追記する。シートがなければ自動作成する。
 * @param {number} wordCount - 英単語件数
 * @param {number} idiomCount - 英熟語件数
 * @param {string} prompt - Geminiへ渡したプロンプト
 * @param {string} response - Geminiからの応答テキスト
 * @param {string} error - エラーメッセージ（なければ空文字）
 */
function writeLog(wordCount, idiomCount, prompt, response, error) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME_LOG);

    // ログシートがなければ新規作成
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME_LOG);
      sheet.appendRow(LOG_HEADERS);
      // ヘッダ行を太字にする
      sheet.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight("bold");
    }

    // プロンプトとレスポンスはセルの上限（50,000文字）を考慮して切り詰め
    var maxCellLen = 40000;
    var trimmedPrompt =
      prompt.length > maxCellLen
        ? prompt.substring(0, maxCellLen) + "…（切り詰め）"
        : prompt;
    var trimmedResponse =
      response.length > maxCellLen
        ? response.substring(0, maxCellLen) + "…（切り詰め）"
        : response;

    sheet.appendRow([
      new Date(),
      wordCount,
      idiomCount,
      trimmedPrompt,
      trimmedResponse,
      error,
    ]);
  } catch (logError) {
    // ログ書き込み自体が失敗してもメイン処理を止めない
    Logger.log("ログ書き込みエラー: " + logError.message);
  }
}
