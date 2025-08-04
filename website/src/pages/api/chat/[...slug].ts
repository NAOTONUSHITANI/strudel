import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import systemPromptContent from '../../../../system_prompt.txt?raw';

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

const MAX_MESSAGES_TO_SEND = 6;

export const GET: APIRoute = async ({ params }) => {
  try {
    const slug = params.slug;
    if (!slug) {
      return new Response('Error: No data provided.', { status: 400 });
    }

    const base64 = slug.replace(/-/g, '+').replace(/_/g, '/');
    const decodedB64 = atob(base64);
    const decodedData = decodeURIComponent(
      Array.prototype.map.call(decodedB64, (c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')
    );
    const { messages } = JSON.parse(decodedData);

    if (!messages || !Array.isArray(messages)) {
      return new Response('Error: Invalid message format.', { status: 400 });
    }

    const systemPrompt = {
      role: 'system',
      content: systemPromptContent,
    };

    const recentMessages = messages.slice(-MAX_MESSAGES_TO_SEND);
    const messagesToSend = [systemPrompt, ...recentMessages];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: messagesToSend,
    });

    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);

  } catch (error) {
    console.error('API Error:', error);
    let errorMessage = 'サーバーで重大なエラーが発生しました。';
    let errorDetails = {};

    if (error instanceof OpenAI.APIError) {
      errorMessage = 'OpenAI APIからエラーが返されました。';
      errorDetails = { message: error.message, status: error.status, type: error.type };
    } else if (error instanceof Error) {
      errorDetails = { message: error.message };
    }

    return new Response(JSON.stringify({ error: errorMessage, details: errorDetails }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
