import { supabase } from '../lib/supabase';
import { TextbookProcessor } from './textbookProcessor';
import { AIService } from './openai';

export interface QARequest {
  question: string;
  bookId: string;
  sessionId?: string;
  userId: string;
}

export interface QAResponse {
  answer: string;
  sources: Array<{
    content: string;
    pageNumber: number;
    section?: string;
    confidence: number;
  }>;
  sessionId: string;
}

export class QAService {
  /**
   * Process a question and generate an answer using RAG (Retrieval-Augmented Generation)
   */
  static async processQuestion(request: QARequest): Promise<QAResponse> {
    try {
      // 1. Search for relevant content from the book
      const relevantChunks = await TextbookProcessor.searchSimilarContent(
        request.question,
        request.bookId,
        5
      );

      // 2. Create or get chat session
      const sessionId = request.sessionId || await this.createChatSession(
        request.userId,
        request.bookId,
        request.question
      );

      // 3. Build context from relevant chunks
      const context = this.buildContext(relevantChunks);

      // 4. Generate AI response using the context
      const answer = await this.generateContextualAnswer(
        request.question,
        context,
        relevantChunks
      );

      // 5. Save the conversation
      await this.saveChatMessage(sessionId, request.question, 'user');
      await this.saveChatMessage(sessionId, answer, 'assistant', {
        sources: relevantChunks.map(chunk => chunk.content),
        confidence: this.calculateConfidence(relevantChunks)
      });

      // 6. Format sources for response
      const sources = relevantChunks.map(chunk => ({
        content: chunk.content.substring(0, 200) + '...',
        pageNumber: chunk.page_number,
        section: chunk.metadata?.section,
        confidence: chunk.similarity || 0.8
      }));

      return {
        answer,
        sources,
        sessionId
      };
    } catch (error) {
      console.error('Error processing question:', error);
      throw new Error('ไม่สามารถประมวลผลคำถามได้ในขณะนี้');
    }
  }

  /**
   * Create a new chat session
   */
  private static async createChatSession(
    userId: string,
    bookId: string,
    firstQuestion: string
  ): Promise<string> {
    const sessionTitle = firstQuestion.length > 50 
      ? firstQuestion.substring(0, 50) + '...'
      : firstQuestion;

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        book_id: bookId,
        title: sessionTitle
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create chat session: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Build context string from relevant chunks
   */
  private static buildContext(chunks: any[]): string {
    if (chunks.length === 0) {
      return 'ไม่พบเนื้อหาที่เกี่ยวข้องในหนังสือ';
    }

    const contextParts = chunks.map((chunk, index) => 
      `[ส่วนที่ ${index + 1}] ${chunk.content}`
    );

    return contextParts.join('\n\n');
  }

  /**
   * Generate contextual answer using AI
   */
  private static async generateContextualAnswer(
    question: string,
    context: string,
    relevantChunks: any[]
  ): Promise<string> {
    const systemPrompt = `คุณเป็น AI ผู้ช่วยการเรียนรู้ที่เชี่ยวชาญในการตอบคำถามจากเนื้อหาหนังสือ

คำแนะนำ:
1. ตอบคำถามโดยอิงจากเนื้อหาที่ให้มาเท่านั้น
2. ใช้ภาษาไทยที่เข้าใจง่าย เหมาะสำหรับนักเรียน
3. ให้คำตอบที่ชัดเจน มีโครงสร้าง และมีตัวอย่างประกอบ
4. หากไม่พบข้อมูลที่เกี่ยวข้อง ให้บอกว่าไม่มีข้อมูลในหนังสือ
5. อ้างอิงหน้าหรือส่วนของหนังสือเมื่อเป็นไปได้

เนื้อหาจากหนังสือ:
${context}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: question }
    ];

    return await AIService.generateResponse(messages, {
      temperature: 0.3, // Lower temperature for more focused answers
      maxTokens: 800
    });
  }

  /**
   * Save chat message to database
   */
  private static async saveChatMessage(
    sessionId: string,
    content: string,
    role: 'user' | 'assistant',
    metadata?: any
  ): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        content,
        role,
        metadata
      });

    if (error) {
      console.error('Error saving chat message:', error);
    }
  }

  /**
   * Calculate confidence score based on similarity scores
   */
  private static calculateConfidence(chunks: any[]): number {
    if (chunks.length === 0) return 0;
    
    const avgSimilarity = chunks.reduce((sum, chunk) => 
      sum + (chunk.similarity || 0.8), 0
    ) / chunks.length;
    
    return Math.round(avgSimilarity * 100) / 100;
  }

  /**
   * Get chat history for a session
   */
  static async getChatHistory(sessionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching chat history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get user's chat sessions for a book
   */
  static async getUserChatSessions(userId: string, bookId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching chat sessions:', error);
      return [];
    }

    return data || [];
  }
}