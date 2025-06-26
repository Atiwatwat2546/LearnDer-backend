import { supabase } from '../lib/supabase';
import { GroqService } from './groq';

export interface ProcessingResult {
  success: boolean;
  chunksProcessed?: number;
  error?: string;
}

export interface TextChunk {
  content: string;
  pageNumber: number;
  chunkIndex: number;
  embedding: number[];
}

export class TextbookProcessor {
  /**
   * Process a PDF file and store embeddings in the database
   */
  static async processPDFFile(
    file: File,
    bookId: string,
    metadata: { title: string; author: string }
  ): Promise<ProcessingResult> {
    try {
      // Update book status to processing
      await this.updateBookStatus(bookId, 'processing');

      // Extract text from PDF
      const pages = await this.extractTextFromPDF(file);
      
      // Process each page and create chunks
      const allChunks: TextChunk[] = [];
      
      for (const page of pages) {
        const chunks = this.chunkText(page.text);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          if (chunk.trim().length > 50) { // Only process meaningful chunks
            const embedding = await this.getEmbedding(chunk);
            
            allChunks.push({
              content: chunk,
              pageNumber: page.pageNumber,
              chunkIndex: i,
              embedding
            });
          }
        }
      }

      // Save chunks to database
      await this.saveChunksToDatabase(bookId, allChunks, metadata);

      // Update book status to completed
      await this.updateBookStatus(bookId, 'completed');

      return {
        success: true,
        chunksProcessed: allChunks.length
      };
    } catch (error) {
      console.error('Error processing PDF:', error);
      
      // Update book status to failed
      await this.updateBookStatus(bookId, 'failed');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Extract text from PDF file
   */
  private static async extractTextFromPDF(file: File): Promise<Array<{ pageNumber: number; text: string }>> {
    // For now, we'll use a simple text extraction
    // In a real implementation, you'd use pdf-parse or similar
    const text = await file.text();
    
    // Simple page simulation - split by form feeds or large gaps
    const pages = text.split(/\f|\n\s*\n\s*\n/).filter(page => page.trim().length > 0);
    
    return pages.map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText.trim()
    }));
  }

  /**
   * Split text into chunks
   */
  private static chunkText(text: string, chunkSize: number = 200, overlap: number = 50): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * Get embedding for text using Groq (fallback method)
   */
  private static async getEmbedding(text: string): Promise<number[]> {
    try {
      // Use Groq's embedding method (which is a fallback since Groq doesn't provide embeddings)
      return await GroqService.getEmbedding(text);
    } catch (error) {
      console.error('Error getting embedding:', error);
      // Return a dummy embedding for development
      return new Array(1536).fill(0).map(() => Math.random() - 0.5);
    }
  }

  /**
   * Save chunks to database
   */
  private static async saveChunksToDatabase(
    bookId: string,
    chunks: TextChunk[],
    metadata: { title: string; author: string }
  ): Promise<void> {
    const chunkData = chunks.map(chunk => ({
      book_id: bookId,
      content: chunk.content,
      embedding: chunk.embedding,
      page_number: chunk.pageNumber,
      chunk_index: chunk.chunkIndex,
      metadata: {
        title: metadata.title,
        author: metadata.author,
        chunk_length: chunk.content.length
      }
    }));

    // Insert chunks in batches to avoid timeout
    const batchSize = 50;
    for (let i = 0; i < chunkData.length; i += batchSize) {
      const batch = chunkData.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('book_embeddings')
        .insert(batch);

      if (error) {
        throw new Error(`Failed to save chunks: ${error.message}`);
      }
    }
  }

  /**
   * Update book processing status
   */
  private static async updateBookStatus(
    bookId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    const { error } = await supabase
      .from('books')
      .update({ processing_status: status })
      .eq('id', bookId);

    if (error) {
      console.error('Error updating book status:', error);
    }
  }

  /**
   * Search for similar content using vector similarity
   */
  static async searchSimilarContent(
    query: string,
    bookId: string,
    limit: number = 5
  ): Promise<any[]> {
    try {
      // Get embedding for the query using Groq
      const queryEmbedding = await this.getEmbedding(query);

      // Use the database function to find similar content
      const { data, error } = await supabase.rpc('match_book_embeddings', {
        query_embedding: queryEmbedding,
        book_id: bookId,
        match_threshold: 0.7,
        match_count: limit
      });

      if (error) {
        console.error('Error searching similar content:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in similarity search:', error);
      return [];
    }
  }

  /**
   * Get processing statistics for a book
   */
  static async getBookProcessingStats(bookId: string): Promise<{
    totalChunks: number;
    avgChunkLength: number;
    pagesCovered: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('book_embeddings')
        .select('content, page_number')
        .eq('book_id', bookId);

      if (error || !data) {
        return { totalChunks: 0, avgChunkLength: 0, pagesCovered: 0 };
      }

      const totalChunks = data.length;
      const avgChunkLength = data.reduce((sum, chunk) => sum + chunk.content.length, 0) / totalChunks;
      const pagesCovered = new Set(data.map(chunk => chunk.page_number)).size;

      return {
        totalChunks,
        avgChunkLength: Math.round(avgChunkLength),
        pagesCovered
      };
    } catch (error) {
      console.error('Error getting processing stats:', error);
      return { totalChunks: 0, avgChunkLength: 0, pagesCovered: 0 };
    }
  }
}