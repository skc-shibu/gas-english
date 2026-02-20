/**
 * Prompt.gs
 * Geminiに渡すプロンプトを組み立てる
 */

/**
 * サンプリングした英単語・英熟語からプロンプト文字列を組み立てる
 * @param {{ rows: { rowIndex: number, data: any[] }[], requested: number, actual: number }} words
 * @param {{ rows: { rowIndex: number, data: any[] }[], requested: number, actual: number }} idioms
 * @returns {string} Geminiに渡すプロンプト全文
 */
function buildPrompt(words, idioms) {
  // ── 入力データの整形（TSV）──
  var wordLines = [];
  for (var i = 0; i < words.rows.length; i++) {
    var d = words.rows[i].data;
    // Word | 品詞 | 重要度 | 主な意味
    wordLines.push(
      [
        d[WORD_COL.WORD],
        d[WORD_COL.POS],
        d[WORD_COL.IMPORTANCE],
        d[WORD_COL.MEANING],
      ].join("\t"),
    );
  }

  var idiomLines = [];
  for (var j = 0; j < idioms.rows.length; j++) {
    var di = idioms.rows[j].data;
    // Idiom / Phrase | 重要度 | 主な意味
    idiomLines.push(
      [
        di[IDIOM_COL.PHRASE],
        di[IDIOM_COL.IMPORTANCE],
        di[IDIOM_COL.MEANING],
      ].join("\t"),
    );
  }

  var wordTsv = wordLines.length > 0 ? wordLines.join("\n") : "（なし）";
  var idiomTsv = idiomLines.length > 0 ? idiomLines.join("\n") : "（なし）";

  // ── システムプロンプト ──
  // NOTE: Google Chat の text メッセージは独自Markdownサブセットのみ対応
  //   太字: *text*（アスタリスク1個）  斜体: _text_  取消線: ~text~
  //   箇条書き: 行頭 "- " または "* "（ネスト不可）
  //   **text** は解釈されないため使用禁止
  var prompt = [
    "あなたは中高生レベルの英語学習を支援する優秀な英語教師です。",
    "以下のルールに厳密に従い、与えられた英単語・英熟語の学習カードを作成してください。",
    "",
    "【絶対ルール】",
    "1. 挨拶・前置き・解説など、指定フォーマット以外のテキストは一切出力しないでください。",
    "2. 各単語/熟語の間には必ず区切り線（───）を入れてください。",
    "3. 番号は通し番号（英単語→英熟語の順に1から振る）。",
    "",
    "【書式ルール ─ Google Chat 用】",
    "- 太字はアスタリスク1個で囲む: *太字* （ **ダブルアスタリスクは禁止** ）",
    '- 箇条書きは行頭に "- " を使う。ネスト（字下げ）は使わず、すべてフラットに書く。',
    "- 「番号＋見出し語」と「例文中の見出し語」を *太字* にすること。",
    "",
    "【重要度の絵文字ルール】",
    "- 9, 10: 🔴",
    "- 7, 8: 🟠",
    "- 1〜6: 無印",
    "",
    "【音節表記】",
    "- アクセント位置を大文字にする（例: ba-NAN-a）",
    "",
    "【品詞が複数ある場合】",
    "- 意味の行で品詞ごとにフラットな箇条書きで併記してください。",
    "",
    "【出力フォーマット（1件ぶん）】",
    "以下を厳守してください:",
    "",
    "───",
    "",
    "*{通し番号}. {英単語 or 英熟語}*",
    "",
    "- 情報: {品詞} | 重要度: {数字}{絵文字} | {音節} | /{発音記号}/",
    "- 意味:",
    "- ({品詞}): {日本語の意味}",
    "- 類義語: {類義語1}, {類義語2}, {類義語3}",
    "- 対義語: {対義語}",
    "- 活用: {過去形} / {過去分詞形}  ※動詞のみ。動詞以外はこの行を省略",
    "- 例文: {短い例文（見出し語を *太字* にする）}",
    "",
    "──────────────────",
    "以下が今回の入力データです。",
    "",
    "■ 英単語（" + words.actual + "件）",
    "Word\t品詞\t重要度\t主な意味",
    wordTsv,
    "",
    "■ 英熟語（" + idioms.actual + "件）",
    "Idiom/Phrase\t重要度\t主な意味",
    idiomTsv,
    "",
    "上記すべてについて、指定フォーマットで出力してください。",
  ].join("\n");

  return prompt;
}
