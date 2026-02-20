/**
 * Gemini.gs
 * Gemini API（generativelanguage.googleapis.com）への呼び出し
 */

/**
 * Gemini generateContent API を呼び出し、生成テキストを返す
 * @param {string} prompt - プロンプト文字列
 * @param {Object} config - loadConfig() の戻り値
 * @returns {string} 生成されたテキスト
 * @throws {Error} API呼び出し失敗時
 */
function callGemini(prompt, config) {
  var apiKey = config[CONFIG_KEY.GEMINI_API_KEY];
  var model = config[CONFIG_KEY.GEMINI_MODEL];
  var temperature =
    Number(config[CONFIG_KEY.TEMPERATURE]) ||
    CONFIG_DEFAULTS[CONFIG_KEY.TEMPERATURE];
  var maxOutputTokens =
    Number(config[CONFIG_KEY.MAX_OUTPUT_TOKENS]) ||
    CONFIG_DEFAULTS[CONFIG_KEY.MAX_OUTPUT_TOKENS];

  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  var payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxOutputTokens,
    },
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();
  var body = response.getContentText();

  if (statusCode !== 200) {
    throw new Error("Gemini API エラー (HTTP " + statusCode + "): " + body);
  }

  var json = JSON.parse(body);

  // レスポンスからテキストを抽出
  var text = extractTextFromGeminiResponse(json);
  if (!text) {
    throw new Error(
      "Gemini API からテキストを取得できませんでした。レスポンス: " +
        JSON.stringify(json).substring(0, 500),
    );
  }

  return text;
}

/**
 * Gemini API レスポンスの JSON からテキスト部分を抽出する
 * @param {Object} json - パース済みレスポンス
 * @returns {string|null} テキスト、取得できなければ null
 */
function extractTextFromGeminiResponse(json) {
  try {
    var candidates = json.candidates;
    if (!candidates || candidates.length === 0) {
      return null;
    }
    var parts = candidates[0].content.parts;
    if (!parts || parts.length === 0) {
      return null;
    }

    // 複数パートがある場合はすべて結合
    var texts = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].text) {
        texts.push(parts[i].text);
      }
    }
    return texts.length > 0 ? texts.join("") : null;
  } catch (e) {
    return null;
  }
}
