import "server-only";

const OPENAI_BASE = "https://api.openai.com/v1";

export function getOpenAIKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Transcribe audio via OpenAI's speech-to-text endpoint.
 * The audio file must be under OpenAI's 25 MB limit — callers enforce that
 * before reaching here.
 */
export async function transcribeAudio(args: {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  apiKey: string;
  model: string;
  /** Optional ISO-639-1 hint; omit for auto-detect. */
  language?: string;
}): Promise<{ text: string }> {
  const form = new FormData();
  const blob = new Blob([args.bytes as unknown as BlobPart], {
    type: args.contentType,
  });
  form.append("file", blob, args.filename);
  form.append("model", args.model);
  form.append("response_format", "json");
  if (args.language) form.append("language", args.language);

  const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await safeErrorText(res);
    throw new Error(`OpenAI transcription failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { text?: string };
  return { text: data.text ?? "" };
}

/**
 * Call the chat completions endpoint and force a JSON response that conforms
 * to the supplied JSON schema (strict mode), returning the parsed object.
 */
export async function chatJson<T>(args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  schemaName: string;
  temperature?: number;
}): Promise<T> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature ?? 0.2,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: args.schemaName,
          strict: true,
          schema: args.jsonSchema,
        },
      },
    }),
  });

  if (!res.ok) {
    const detail = await safeErrorText(res);
    throw new Error(`OpenAI chat completion failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI chat completion returned no content");
  }
  return JSON.parse(content) as T;
}

async function safeErrorText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}
