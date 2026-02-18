/**
 * Sheets.gs
 * シートからの行読み取り、未学習行の抽出、ランダムサンプリング、済更新
 */

// ──────────────────────────────────────────────
// 未学習行の取得
// ──────────────────────────────────────────────

/**
 * 指定シートから「済」が空/false の行を取得する
 * 各要素は { rowIndex: number (1-indexed), data: any[] } の形式
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {{ rowIndex: number, data: any[] }[]}
 */
function getUnfinishedRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return []; // ヘッダ行のみ
  }

  var lastCol = sheet.getLastColumn();
  // 2行目（ヘッダの次）からデータ末尾まで取得
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var results = [];

  for (var i = 0; i < data.length; i++) {
    var done = data[i][0]; // 済列（チェックボックス or 文字列）
    if (!done || done === false || String(done).trim() === '') {
      results.push({
        rowIndex: i + 2, // シート上の行番号（1-indexed、ヘッダ行=1）
        data: data[i]
      });
    }
  }

  return results;
}

// ──────────────────────────────────────────────
// Fisher-Yates シャッフル
// ──────────────────────────────────────────────

/**
 * 配列をインプレースでシャッフルする（Fisher-Yates）
 * @param {any[]} array
 * @returns {any[]} シャッフル後の同じ配列
 */
function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

// ──────────────────────────────────────────────
// ランダムサンプリング
// ──────────────────────────────────────────────

/**
 * 未学習行からランダムに指定数をサンプリングする
 * 不足した場合はあるだけ返す
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} count - 取得したい件数
 * @returns {{ rows: { rowIndex: number, data: any[] }[], requested: number, actual: number }}
 */
function sampleUnfinishedRows(sheet, count) {
  var unfinished = getUnfinishedRows(sheet);
  shuffleArray(unfinished);

  var actual = Math.min(unfinished.length, count);
  var sampled = unfinished.slice(0, actual);

  return {
    rows: sampled,
    requested: count,
    actual: actual
  };
}

// ──────────────────────────────────────────────
// 英単語・英熟語を一括サンプリング
// ──────────────────────────────────────────────

/**
 * 英単語シートと英熟語シートから未学習行をサンプリングする
 * @param {Object} config - loadConfig() の戻り値
 * @returns {{ words: Object, idioms: Object, shortageMessage: string }}
 *   words / idioms は sampleUnfinishedRows の戻り値
 *   shortageMessage は不足がある場合のみ文字列、なければ空文字
 */
function sampleAll(config) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 英単語シート
  var wordSheet = ss.getSheetByName(SHEET_NAME_WORDS);
  if (!wordSheet) {
    throw new Error('「' + SHEET_NAME_WORDS + '」シートが見つかりません。');
  }
  validateHeaders(wordSheet, WORD_HEADERS);

  // 英熟語シート
  var idiomSheet = ss.getSheetByName(SHEET_NAME_IDIOMS);
  if (!idiomSheet) {
    throw new Error('「' + SHEET_NAME_IDIOMS + '」シートが見つかりません。');
  }
  validateHeaders(idiomSheet, IDIOM_HEADERS);

  var wordCount  = Number(config[CONFIG_KEY.WORD_COUNT])  || CONFIG_DEFAULTS[CONFIG_KEY.WORD_COUNT];
  var idiomCount = Number(config[CONFIG_KEY.IDIOM_COUNT]) || CONFIG_DEFAULTS[CONFIG_KEY.IDIOM_COUNT];

  var words  = sampleUnfinishedRows(wordSheet, wordCount);
  var idioms = sampleUnfinishedRows(idiomSheet, idiomCount);

  // 不足メッセージの組み立て
  var shortages = [];
  if (words.actual < words.requested) {
    shortages.push(
      '英単語: ' + words.actual + '/' + words.requested + '件'
    );
  }
  if (idioms.actual < idioms.requested) {
    shortages.push(
      '英熟語: ' + idioms.actual + '/' + idioms.requested + '件'
    );
  }

  var shortageMessage = '';
  if (shortages.length > 0) {
    shortageMessage = '⚠ 未学習データが不足しています（' + shortages.join('、') + '）';
  }

  if (words.actual === 0 && idioms.actual === 0) {
    throw new Error(
      '未学習の英単語・英熟語がありません。' +
      'シートに新しいデータを追加するか、済チェックを外してください。'
    );
  }

  return {
    words: words,
    idioms: idioms,
    shortageMessage: shortageMessage
  };
}

// ──────────────────────────────────────────────
// 済チェックの更新
// ──────────────────────────────────────────────

/**
 * サンプリングした行の「済」列に TRUE を書き込む
 * @param {string} sheetName - シート名
 * @param {{ rowIndex: number, data: any[] }[]} rows - サンプリング結果の rows
 */
function markRowsAsDone(sheetName, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return;
  }

  for (var i = 0; i < rows.length; i++) {
    // 済列は1列目（A列）、rowIndex は 1-indexed
    sheet.getRange(rows[i].rowIndex, 1).setValue(true);
  }
}
