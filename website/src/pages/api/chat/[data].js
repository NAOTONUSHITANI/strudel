// website/src/pages/api/chat/[data].js

import { promises as fs } from 'fs';
import path from 'path';

// OpenAIライブラリの代わりに、標準のfetchを使用します。
// これにより、ライブラリの非互換性問題を完全に回避します。

export async function GET({ params }) {
  try {
    // 0. システムプロンプトをファイルから読み込む
    // AstroのAPIルートでは、process.cwd()は既に 'website' ディレクトリを指している
    const promptPath = path.join(process.cwd(), 'system_prompt.txt');
    const systemPrompt = await fs.readFile(promptPath, 'utf-8');

    // 1. APIキーの検証
    const apiKey = import.meta.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('環境変数 OPENAI_API_KEY がサーバーに設定されていません。');
    }

    // 2. リクエストデータの処理
    const encodedData = params.data;
    if (!encodedData) {
      return new Response(JSON.stringify({ error: 'No data provided' }), { status: 400 });
    }

    const decodedStr = decodeURIComponent(atob(encodedData.replace(/-/g, '+').replace(/_/g, '/')));
    const { messages } = JSON.parse(decodedStr);

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), { status: 400 });
    }

    // 3. fetchを使用してOpenAI APIを直接呼び出す
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...messages,
        ],
      }),
    });

    // 4. OpenAIからの応答を検証
    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API returned an error: ${errorData.error?.message || openAIResponse.statusText}`);
    }

    const completion = await openAIResponse.json();
    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error('Invalid response structure from OpenAI API.');
    }

    // 5. 成功レスポンスをクライアントに送信
    return new Response(JSON.stringify({ response: responseContent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    // 最終的なエラーハンドリング
    console.error('Critical API Error:', error);
    return new Response(JSON.stringify({
      error: 'サーバーで重大なエラーが発生しました。',
      details: { message: error.message }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
