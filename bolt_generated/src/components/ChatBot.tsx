import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Book, Sparkles, BookOpen, Play, Loader, AlertCircle, Zap } from 'lucide-react';
import { QAService } from '../services/qaService';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  sources?: Array<{
    content: string;
    pageNumber: number;
    section?: string;
    confidence: number;
  }>;
}

interface ChatBotProps {
  selectedBook?: {
    id: string;
    title: string;
    author: string;
  };
  currentPage?: number;
  currentContent?: {
    title: string;
    content: string;
  };
  onBookSelect?: (bookId: string) => void;
  onReadBook?: () => void;
}

const ChatBot: React.FC<ChatBotProps> = ({
  selectedBook,
  currentPage,
  currentContent,
  onBookSelect,
  onReadBook
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const availableBooks = [
    { id: '1', title: 'วิทยาศาสตร์น่ารู้ ชั้นมัธยมศึกษาตอนต้น', author: 'ดร.สมชาย วิทยาคม' },
    { id: '2', title: 'คณิตศาสตร์พื้นฐานเพื่อชีวิต', author: 'อาจารย์สมหญิง เลขคณิต' },
    { id: '3', title: 'ประวัติศาสตร์ไทย เรื่องราวที่น่าทึ่ง', author: 'ศาสตราจารย์พิมพ์ใจ ประวัติศาสตร์' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      text: selectedBook
        ? (
          currentPage
            ? `สวัสดีครับ/ค่ะ! 😊 ครูยินดีที่ได้ช่วยเหลือนักเรียน\n\nตอนนี้เรากำลังเรียนรู้ "${selectedBook.title}" หน้า ${currentPage} กันอยู่นะครับ\n\n🤔 มีคำถามอะไรเกี่ยวกับเนื้อหาที่อ่านไหมครับ? ครูพร้อมอธิบายให้ฟังแล้วนะ!`
            : `สวัสดีครับ/ค่ะ นักเรียน! 📚✨\n\nยินดีต้อนรับสู่การเรียนรู้กับ "${selectedBook.title}" ของ ${selectedBook.author}\n\n🎯 ครูพร้อมช่วยอธิบายเนื้อหา ตอบคำถาม และทำให้การเรียนรู้สนุกมากขึ้น!\n\nลองถามครูดูสิครับ/ค่ะ 😊`
        )
        : `สวัสดีครับ/ค่ะ นักเรียน! 🤖📖\n\nครูเป็น AI ผู้ช่วยการเรียนรู้ที่พร้อมช่วยเหลือคุณเสมอ!\n\n✨ คุณสามารถถามครูได้เลย ไม่ต้องเลือกหนังสือก็ได้นะ เช่น:\n• "ครูช่วยอธิบายเรื่องแรงโน้มถ่วงหน่อย"\n• "สูตรคณิตศาสตร์พื้นฐานมีอะไรบ้าง"\n• "เล่าประวัติศาสตร์ไทยให้ฟังหน่อย"\n\n🎓 ครูพร้อมอธิบายให้เข้าใจง่ายๆ แล้วนะครับ!`,
      isBot: true,
      timestamp: new Date()
    };

    setMessages([welcomeMessage]);
  }, [selectedBook, currentPage]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      if (selectedBook) {
        // Use the new QA service for book-specific questions
        const response = await QAService.processQuestion({
          question: inputText,
          bookId: selectedBook.id,
          sessionId: sessionId || undefined,
          userId: 'current-user-id' // Replace with actual user ID
        });

        if (!sessionId) {
          setSessionId(response.sessionId);
        }

        const botResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: response.answer,
          isBot: true,
          timestamp: new Date(),
          sources: response.sources
        };

        setMessages(prev => [...prev, botResponse]);
      } else {
        // Fallback to mock response for general questions
        setTimeout(() => {
          const botResponse: Message = {
            id: (Date.now() + 1).toString(),
            text: generateMockResponse(inputText),
            isBot: true,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, botResponse]);
          setIsTyping(false);
        }, 1500);
        return;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'ขออภัยนะครับ/ค่ะ 😅 ตอนนี้ครูมีปัญหาทางเทคนิคเล็กน้อย\n\nกรุณาลองถามใหม่อีกครั้งในอีกสักครู่นะครับ หรือลองเปลี่ยนคำถามดูครับ\n\n🔧 ครูกำลังแก้ไขปัญหาให้เร็วที่สุดแล้วนะ!',
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateMockResponse = (input: string) => {
    const responses = [
      `เรื่อง "${input}" เป็นหัวข้อที่น่าสนใจมากเลยนะครับ! 😊\n\nตามความรู้ทั่วไปที่ครูมี สามารถอธิบายได้ดังนี้...\n\n📚 แต่ถ้าอยากได้คำตอบที่ละเอียดและแม่นยำมากขึ้น แนะนำให้เลือกหนังสือที่เกี่ยวข้องก่อนนะครับ แล้วครูจะสามารถอธิบายจากเนื้อหาในหนังสือได้อย่างชัดเจน!\n\n🎯 มีคำถามอื่นอีกไหมครับ?`,
      
      `คำถามเกี่ยวกับ "${input}" เป็นคำถามที่ดีมากเลยครับ! 👍\n\nครูจะพยายามอธิบายตามความรู้ทั่วไป แต่เพื่อให้ได้คำตอบที่ครบถ้วนและมีรายละเอียดมากขึ้น...\n\n💡 ลองเลือกหนังสือที่เกี่ยวข้องกับหัวข้อนี้ดูนะครับ แล้วครูจะสามารถให้ข้อมูลที่แม่นยำและมีตัวอย่างประกอบได้ดีกว่านี้!\n\n📖 อยากลองเลือกหนังสือไหมครับ?`,
      
      `"${input}" เป็นเรื่องที่ครูสามารถช่วยอธิบายได้นะครับ! ✨\n\nจากความรู้พื้นฐานที่ครูมี สามารถให้ข้อมูลเบื้องต้นได้...\n\n🎓 แต่ถ้าต้องการเรียนรู้อย่างลึกซึ้งและมีแหล่งอ้างอิงที่ชัดเจน ครูแนะนำให้เลือกหนังสือที่เหมาะสมก่อนนะครับ\n\n🤔 มีหนังสือไหนที่อยากเรียนรู้เป็นพิเศษไหมครับ?`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getQuickActions = () => {
    if (currentPage && currentContent) {
      return [
        `ครูช่วยอธิบายเนื้อหาหน้า ${currentPage} ให้ฟังหน่อยครับ`,
        `สรุปประเด็นสำคัญในหน้านี้ให้หน่อย`,
        `ยกตัวอย่างจากชีวิตจริงเกี่ยวกับเนื้อหานี้หน่อย`,
        `ให้แบบฝึกหัดจากเนื้อหาหน้านี้หน่อยครับ`
      ];
    } else if (selectedBook) {
      return [
        'ครูช่วยสรุปหนังสือเล่มนี้ให้ฟังหน่อย',
        'เล่าเรื่องในหนังสือให้ฟังหน่อยครับ',
        'ให้แบบฝึกหัดจากเนื้อหาในหนังสือหน่อย',
        'อธิบายแนวคิดหลักในหนังสือให้ฟังหน่อย'
      ];
    } else {
      return [
        'ครูช่วยแนะนำหนังสือที่น่าสนใจหน่อย',
        'อยากเรียนรู้เรื่องวิทยาศาสตร์ครับ',
        'ครูช่วยอธิบายคณิตศาสตร์หน่อย',
        'เล่าประวัติศาสตร์ให้ฟังหน่อยครับ'
      ];
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 sm:p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-white bg-opacity-20 p-2 rounded-full">
            <div className="relative">
              <Bot className="h-6 w-6" />
              <Zap className="h-3 w-3 absolute -top-1 -right-1 text-yellow-300" />
            </div>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold">🤖 ครู AI ผู้ช่วยการเรียนรู้</h2>
            <p className="text-blue-100 text-sm">
              {selectedBook ? `📚 กำลังเรียนรู้: ${selectedBook.title}` : '✨ พร้อมช่วยเหลือคุณแล้ว!'}
            </p>
          </div>
        </div>
      </div>

      {/* Book Selection */}
      {selectedBook && (
        <div className="p-4 border-b bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Book className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{selectedBook.title}</p>
                <p className="text-xs text-gray-600">โดย {selectedBook.author}</p>
              </div>
            </div>
            {onReadBook && (
              <button
                onClick={onReadBook}
                className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Play className="h-4 w-4" />
                <span>อ่านหนังสือ</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg ${message.isBot
                  ? 'bg-gradient-to-r from-gray-50 to-blue-50 text-gray-800 border border-blue-100'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                }`}
            >
              <div className="flex items-start space-x-2">
                {message.isBot && (
                  <div className="relative">
                    <Bot className="h-5 w-5 mt-0.5 text-blue-600 flex-shrink-0" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"></div>
                  </div>
                )}
                {!message.isBot && (
                  <User className="h-5 w-5 mt-0.5 text-white flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                  
                  {/* Show sources if available */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs font-medium text-blue-700 mb-2 flex items-center">
                        <Sparkles className="h-3 w-3 mr-1" />
                        แหล่งข้อมูลจากหนังสือ:
                      </p>
                      <div className="space-y-2">
                        {message.sources.map((source, index) => (
                          <div key={index} className="bg-white p-2 rounded border-l-2 border-blue-400 shadow-sm">
                            <p className="text-xs text-gray-700 leading-relaxed">{source.content}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-500">
                                📄 หน้า {source.pageNumber}
                                {source.section && ` • ${source.section}`}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">
                                ✓ {Math.round(source.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className={`text-xs mt-1 ${message.isBot ? 'text-gray-500' : 'text-blue-100'
                    }`}>
                    {message.timestamp.toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-3 rounded-lg border border-blue-100">
              <div className="flex items-center space-x-2">
                <Bot className="h-5 w-5 text-blue-600" />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-blue-600">ครูกำลังคิดคำตอบ...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-4 bg-gray-50">
        <div className="flex space-x-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="💭 ถามคำถามหรือขอความช่วยเหลือจากครู..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            rows={2}
            disabled={isTyping}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isTyping}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isTyping ? <Loader className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>

        {/* Quick actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {getQuickActions().map((action, index) => (
            <button
              key={index}
              onClick={() => setInputText(action)}
              disabled={isTyping}
              className="text-xs bg-white text-gray-700 px-3 py-1.5 rounded-full hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-colors border border-gray-200 shadow-sm"
            >
              {action}
            </button>
          ))}
        </div>

        {/* Connection status */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>เชื่อมต่อกับ Groq AI สำเร็จ</span>
          </div>
          {selectedBook && (
            <span className="flex items-center space-x-1">
              <Zap className="h-3 w-3" />
              <span>Vector Search พร้อมใช้งาน</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBot;