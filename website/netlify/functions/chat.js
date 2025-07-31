// website/netlify/functions/chat.js

const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 0. システムプロンプトをファイルから読み込む
    // Netlify関数の実行パスを考慮して、プロジェクトルートからの相対パスを構築
    const promptPath = path.resolve(process.cwd(), 'website', 'system_prompt.txt');
    const systemPrompt = await fs.readFile(promptPath, 'utf-8');

    // 1. リクエストボディからメッセージを取得
    const { messages } = JSON.parse(event.body);
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Invalid messages format');
    }

    // 2. 環境変数からAPIキーとモデル名を取得
    const apiKey = process.env.OPENAI_API_KEY;
    const modelName = process.env.OPENAI_MODEL_NAME || 'gpt-4o';

    if (!apiKey) {
      throw new Error('APIキーが設定されていません。');
    }

    // 3. OpenAI APIを呼び出す
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI APIからエラーが返されました: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const responseContent = data.choices?.[0]?.message?.content;

    if (!responseContent) {
      throw new Error('Invalid response structure from OpenAI API.');
    }

    // 4. 正しいヘッダーで応答を返す
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ response: responseContent }),
    };

  } catch (error) {
    console.error('Handler Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};