interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface GroqOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export class GroqService {
  private static readonly API_KEY = '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';
  private static readonly BASE_URL = 'https://api.groq.com/openai/v1';
  private static readonly DEFAULT_MODEL = 'llama-3.1-70b-versatile';

  /**
   * Generate response using Groq API
   */
  static async generateResponse(
    messages: GroqMessage[],
    options: GroqOptions = {}
  ): Promise<string> {
    try {
      const {
        temperature = 0.3,
        maxTokens = 1000,
        model = this.DEFAULT_MODEL
      } = options;

      const response = await fetch(`${this.BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Groq API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data: GroqResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response generated from Groq API');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error calling Groq API:', error);
      throw new Error(
        error instanceof Error 
          ? `ไม่สามารถเชื่อมต่อกับ AI ได้: ${error.message}`
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI'
      );
    }
  }

  /**
   * Generate text embeddings (fallback to a simple method since Groq doesn't provide embeddings)
   */
  static async getEmbedding(text: string): Promise<number[]> {
    // Since Groq doesn't provide embeddings, we'll use a simple hash-based approach
    // In production, you might want to use a dedicated embedding service
    const hash = this.simpleHash(text);
    const embedding = new Array(1536).fill(0).map((_, i) => {
      return Math.sin(hash + i) * 0.5;
    });
    
    return embedding;
  }

  /**
   * Simple hash function for generating consistent embeddings
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Check if the API is available
   */
  static async checkConnection(): Promise<boolean> {
    try {
      const response = await this.generateResponse([
        { role: 'user', content: 'สวัสดี' }
      ], { maxTokens: 10 });
      
      return response.length > 0;
    } catch (error) {
      console.error('Groq connection check failed:', error);
      return false;
    }
  }

  /**
   * Get available models
   */
  static getAvailableModels(): string[] {
    return [
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma-7b-it'
    ];
  }
}