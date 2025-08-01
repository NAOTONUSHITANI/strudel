// website/src/pages/api/chat/[data].js

import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Manually load environment variables from the root .env file
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

    // 3. fetchを使用してOpenAI APIをストリーミングモードで呼び出す
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
        stream: true, // ストリーミングを有効化
      }),
    });

    // 4. OpenAIからの応答を検証
    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API returned an error: ${errorData.error?.message || openAIResponse.statusText}`);
    }

    // 5. レスポンスをクライアントにストリーミングする
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openAIResponse.body.getReader();
        const decoder = new TextDecoder('utf-8');

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line === 'data: [DONE]') {
                controller.close();
                return;
              }
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6);
                try {
                  const parsed = JSON.parse(jsonStr);
                  const content = parsed.choices[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(content));
                  }
                } catch (e) {
                  console.error('Error parsing stream chunk:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream reading error:', error);
          controller.error(error);
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
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
