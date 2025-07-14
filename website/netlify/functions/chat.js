// website/netlify/functions/chat.js

// Strudelに特化したAIアシスタントの役割を定義するシステムプロンプト
const strudelAssistantPrompt = `あなたはStrudelというWebベースのライブコーディング環境に特化したAIアシスタントです。ユーザーの指示に応じて、正しいStrudelコードを生成してください。コードには可能な限り日本語のコメントをつけてください。`;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { message } = JSON.parse(event.body);

    // 環境変数からAPIキーとモデル名を取得
    const apiKey = process.env.OPENAI_API_KEY;
    const modelName = process.env.OPENAI_MODEL_NAME || 'gpt-4.1'; // デフォルト値を設定

    if (!apiKey) {
      throw new Error('APIキーが設定されていません。');
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: strudelAssistantPrompt },
          { role: "user", content: message }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI APIからエラーが返されました: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "応答がありませんでした。";

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    };

  } catch (error) {
    console.error('Handler Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
