import { supabase } from '../lib/supabase';
import { TextbookProcessor } from './textbookProcessor';
import { GroqService } from './groq';

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
      throw new Error('ขออภัยครับ/ค่ะ เกิดข้อผิดพลาดในการประมวลผลคำถาม กรุณาลองใหม่อีกครั้งนะครับ');
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
      `[ส่วนที่ ${index + 1} - หน้า ${chunk.page_number}]\n${chunk.content}`
    );

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Generate contextual answer using Groq AI
   */
  private static async generateContextualAnswer(
    question: string,
    context: string,
    relevantChunks: any[]
  ): Promise<string> {
    const systemPrompt = `คุณเป็น AI ผู้ช่วยการเรียนรู้ที่เชี่ยวชาญในการตอบคำถามจากเนื้อหาหนังสือการศึกษา

## บทบาทและหน้าที่ของคุณ:
คุณเป็นครูผู้ช่วยที่อดทน เข้าใจ และเป็นมิตรกับนักเรียน มีความเชี่ยวชาญในการอธิบายเนื้อหาให้เข้าใจง่าย

## หลักการตอบคำถาม:
1. **ใช้เฉพาะเนื้อหาที่ให้มา**: ตอบคำถามโดยอิงจากเนื้อหาในหนังสือเท่านั้น ห้ามแต่งเติมข้อมูลจากภายนอก
2. **ภาษาไทยที่เข้าใจง่าย**: ใช้ภาษาไทยที่ชัดเจน เหมาะสำหรับนักเรียนระดับมัธยมศึกษา
3. **โครงสร้างที่ชัดเจน**: จัดเรียงคำตอบให้มีหัวข้อ ข้อย่อย และตัวอย่างประกอบ
4. **ตอบตรงประเด็น**: ตอบเฉพาะสิ่งที่ถูกถาม ไม่ขยายความนอกเรื่อง
5. **ให้กำลังใจ**: ใช้น้ำเสียงที่ให้กำลังใจและสร้างแรงบันดาลใจในการเรียนรู้
6. **ใช้คำสุภาพ**: ใช้คำว่า "ครับ/ค่ะ" ในการตอบทุกครั้ง และเรียกผู้ถามว่า "นักเรียน" หรือ "น้อง"

## รูปแบบการตอบ:
- เริ่มต้นด้วยการทักทายและแสดงความเข้าใจในคำถาม (ใช้ครับ/ค่ะ)
- อธิบายแนวคิดหลักอย่างชัดเจน
- ให้ตัวอย่างจากเนื้อหาหนังสือ (ถ้ามี)
- สรุปประเด็นสำคัญ
- ปิดท้ายด้วยการสอบถามว่ามีคำถามเพิ่มเติมหรือไม่ (ใช้ครับ/ค่ะ)

## ตัวอย่างการใช้คำสุภาพ:
- "ครูเข้าใจคำถามของนักเรียนแล้วนะครับ/ค่ะ"
- "จากเนื้อหาในหนังสือ สามารถอธิบายได้ดังนี้ครับ/ค่ะ"
- "หวังว่าคำอธิบายนี้จะช่วยให้เข้าใจมากขึ้นนะครับ/ค่ะ"
- "มีคำถามอื่นอีกไหมครับ/ค่ะ?"

## สิ่งที่ห้ามทำ:
❌ ห้ามแต่งข้อมูลที่ไม่มีในหนังสือ
❌ ห้ามใช้ภาษาที่ซับซ้อนเกินไป
❌ ห้ามตอบนอกเรื่องหรือขยายความมากเกินไป
❌ ห้ามใช้น้ำเสียงที่เป็นทางการจนเกินไป
❌ ห้ามลืมใช้คำว่า "ครับ/ค่ะ" ในการตอบ
❌ ห้ามให้ข้อมูลที่อาจเป็นอันตรายหรือไม่เหมาะสม

## เมื่อไม่พบข้อมูล:
หากไม่พบข้อมูลที่เกี่ยวข้องในหนังสือ ให้ตอบว่า:
"ขออภัยนะครับ/ค่ะ ในหนังสือเล่มนี้ไม่มีข้อมูลเกี่ยวกับเรื่องที่นักเรียนถามโดยตรง แต่ถ้ามีคำถามอื่นเกี่ยวกับเนื้อหาในหนังสือ ครูยินดีช่วยอธิบายให้ฟังนะครับ/ค่ะ"

## เนื้อหาจากหนังสือ:
${context}

จำไว้: คุณเป็นครูที่ใส่ใจนักเรียน อยากให้นักเรียนเข้าใจและรักการเรียนรู้ ตอบด้วยความอดทนและความเข้าใจเสมอ และอย่าลืมใช้คำว่า "ครับ/ค่ะ" ในทุกการตอบครับ`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `คำถาม: ${question}` }
    ];

    return await GroqService.generateResponse(messages, {
      temperature: 0.3, // Lower temperature for more focused answers
      maxTokens: 1200,
      model: 'llama-3.1-70b-versatile' // Use the most capable model
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