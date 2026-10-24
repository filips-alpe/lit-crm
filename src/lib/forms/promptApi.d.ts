// Minimal ambient types for Chrome's built-in Prompt API (Gemini Nano).
// Spec: https://developer.chrome.com/docs/ai/prompt-api
export {};

declare global {
  type LanguageModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

  interface LanguageModelPromptOptions {
    responseConstraint?: unknown;
    signal?: AbortSignal;
  }

  interface LanguageModelMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }

  interface LanguageModelCreateOptions {
    initialPrompts?: LanguageModelMessage[];
    temperature?: number;
    topK?: number;
    signal?: AbortSignal;
  }

  interface LanguageModelSession {
    prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
    destroy(): void;
  }

  interface LanguageModelStatic {
    availability(): Promise<LanguageModelAvailability>;
    create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
  }

  var LanguageModel: LanguageModelStatic | undefined;
}
