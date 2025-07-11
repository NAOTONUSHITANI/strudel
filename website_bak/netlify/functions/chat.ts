import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  // CORSヘッダーの設定
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // プリフライトリクエストの処理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // POSTリクエストの処理
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const message = body.message;

      if (!message) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'メッセージが必要です。' })
        };
      }

      // ここに実際のチャット処理を実装
      const response = `受け取ったメッセージ: ${message}`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ response })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'サーバーエラーが発生しました。' })
      };
    }
  }

  // その他のHTTPメソッドは許可しない
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'メソッドが許可されていません。' })
  };
};