// website/src/pages/api/chat/[data].js

import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Manually load environment variables from the root .env file
// The path goes up one level from /website to the project root.
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export async function GET({ params }) {
  try {
    // 0. システムプロンプトをファイルから読み込む
    const promptPath = path.join(process.cwd(), 'system_prompt.txt');
    const systemPrompt = await fs.readFile(promptPath, 'utf-8');

    // 1. APIキーの検証
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('サーバー側でAPIキーが設定されていません。');
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
    console.error('[API CRITICAL ERROR]', error.message);
    return new Response(JSON.stringify({
      error: 'サーバーで重大なエラーが発生しました。',
      details: { message: error.message }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
