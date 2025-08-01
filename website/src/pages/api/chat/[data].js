// website/src/pages/api/chat/[data].js

import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Manually load environment variables from the root .env file
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

// Helper to parse Server-Sent Events (SSE) from the OpenAI stream
function parseSSE(chunk) {
  const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
  const content = [];
  for (const line of lines) {
    const jsonStr = line.substring(6);
    if (jsonStr.trim() === '[DONE]') {
      return { done: true, content: '' };
    }
    try {
      const parsed = JSON.parse(jsonStr);
      const delta = parsed.choices[0]?.delta?.content;
      if (delta) {
        content.push(delta);
      }
    } catch (e) {
      // Ignore parsing errors for non-JSON lines
    }
  }
  return { done: false, content: content.join('') };
}


export async function GET({ params }) {
  try {
    // 1. System prompt and API key validation
    const promptPath = path.join(process.cwd(), 'system_prompt.txt');
    const systemPrompt = await fs.readFile(promptPath, 'utf-8');
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('Server-side API key is not configured.');
    }

    // 2. Process request data
    const encodedData = params.data;
    if (!encodedData) {
      return new Response(JSON.stringify({ error: 'No data provided' }), { status: 400 });
    }
    const decodedStr = decodeURIComponent(atob(encodedData.replace(/-/g, '+').replace(/_/g, '/')));
    const { messages } = JSON.parse(decodedStr);

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), { status: 400 });
    }

    // 3. Call OpenAI API with streaming enabled
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true, // Enable streaming
      }),
    });

    // 4. Validate OpenAI's initial response
    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API returned an error: ${errorData.error?.message || openAIResponse.statusText}`);
    }

    // 5. Create a ReadableStream to pipe the response to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openAIResponse.body.getReader();
        const decoder = new TextDecoder('utf-8');

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            const chunk = decoder.decode(value, { stream: true });
            const parsed = parseSSE(chunk);
            if (parsed.done) {
              break;
            }
            if (parsed.content) {
              controller.enqueue(new TextEncoder().encode(parsed.content));
            }
          }
        } catch (error) {
          console.error('Error while reading stream:', error);
          controller.error(error);
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    // 6. Return the stream as the response
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
      error: 'A critical server error occurred.',
      details: { message: error.message }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
