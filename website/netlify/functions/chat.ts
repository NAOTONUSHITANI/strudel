import type { Handler, HandlerEvent } from '@netlify/functions';
import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import systemPromptContent from '../../src/system_prompt.txt?raw';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_MESSAGES_TO_SEND = 6;

const handler: Handler = async (event: HandlerEvent) => {
  try {
    const slug = event.path.split('/').pop() || '';
    if (!slug) {
      return {
        statusCode: 400,
        body: 'Error: No data provided.',
      };
    }

    const base64 = slug.replace(/-/g, '+').replace(/_/g, '/');
    const decodedData = atob(base64);
    const { messages } = JSON.parse(decodedData);

    if (!messages || !Array.isArray(messages)) {
      return {
        statusCode: 400,
        body: 'Error: Invalid message format.',
      };
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
    const streamingResponse = new StreamingTextResponse(stream);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: streamingResponse.body,
    };

  } catch (error) {
    console.error('API Error:', error);
    let errorMessage = 'サーバーで重大なエラーが発生しました。';
    let errorDetails = {};

    if (error instanceof OpenAI.APIError) {
      errorMessage = 'OpenAI APIからエラーが返されました。';
      errorDetails = {
        message: error.message,
        status: error.status,
        type: error.type,
      };
    } else if (error instanceof Error) {
      errorDetails = { message: error.message };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage, details: errorDetails }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

export { handler };
