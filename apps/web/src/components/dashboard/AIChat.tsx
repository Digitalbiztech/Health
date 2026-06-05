import { useState, useEffect, useRef } from 'react';
import { Loader2, Send, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { sendChatMessage } from '@/lib/api';
import type { Biomarker, PatientRecord } from '@/types/dashboard';

interface ChatProps {
  biomarkers: Biomarker[];
  patient?: PatientRecord;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIChat({ biomarkers, patient }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I am your Personalized Medical Care chat agent. I can review your lab results, analyze trends, and even read medical flowcharts or guidelines if you upload them. How can I help you today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(textToSend = input) {
    if (!textToSend.trim() || loading) return;

    const userText = textToSend;
    setInput('');
    const nextMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const { reply } = await sendChatMessage({
        messages: nextMessages,
        biomarkers: biomarkers.map((b) => ({
          displayName: b.displayName,
          value: b.value,
          unit: b.unit,
          referenceRange: b.referenceRange,
          status: b.status,
        })),
        patient: patient
          ? {
              firstName: patient.firstName,
              lastName: patient.lastName,
              gender: patient.gender,
              dateOfBirth: patient.dateOfBirth,
            }
          : undefined,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Apologies, my clinical communications link timed out. Please try asking again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#182737] shadow-lg overflow-hidden flex flex-col h-[600px] bg-[#0d1721] animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#182737] flex items-center justify-between bg-[#091018]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-[#1e2f41] flex items-center justify-center font-serif text-sm font-bold text-[#dfc2b0] bg-[#0c151f] shrink-0 select-none shadow-inner">
            C
          </div>
          <div>
            <h5 className="text-[11px] font-bold tracking-wider text-[#dfc2b0] uppercase">Personalized Medical Care</h5>
            <p className="text-[10px] text-muted-foreground flex items-center mt-0.5 font-medium">
              chat agent
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full mx-1.5 animate-pulse" />
              <span className="text-[#10b981] font-semibold">Online</span>
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar bg-[#0d1721]">
        {messages.map((msg, idx) => {
          const isAI = msg.role === 'assistant';
          return (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-3 max-w-[85%]',
                isAI ? 'self-start' : 'self-end flex-row-reverse'
              )}
            >
              {/* Avatar */}
              {isAI ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#dfc2b0] shrink-0 font-serif text-xs font-bold text-[#4a3d33] select-none shadow-md">
                  C
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full border border-[#1e2f41] flex items-center justify-center bg-[#0d1c2b] shrink-0 text-[#00b8ff] select-none shadow-md">
                  <User className="w-4 h-4" />
                </div>
              )}

              {/* Bubble */}
              <div
                className={cn(
                  'rounded-2xl p-4 text-xs leading-relaxed shadow-sm transition-all duration-200',
                  isAI
                    ? 'bg-[#13202e] border border-[#182737] text-[#f3f4f6] rounded-tl-none'
                    : 'bg-[#dfc2b0] text-[#1c1917] rounded-tr-none font-medium'
                )}
              >
                {isAI ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/30 text-[#e5e7eb] font-sans">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex items-start gap-3 max-w-[85%] self-start animate-pulse">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#dfc2b0] shrink-0 font-serif text-xs font-bold text-[#4a3d33] select-none shadow-md">
              C
            </div>
            <div className="bg-[#13202e] border border-[#182737] text-gray-400 rounded-2xl rounded-tl-none p-4 flex items-center gap-2.5 text-xs shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#dfc2b0]" />
              <span>Analyzing diagnostic parameters...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggestions */}
      <div className="px-6 py-2.5 flex flex-wrap gap-2 border-t border-[#182737]/60 bg-[#091018]">
        {[
          'Explain my cholesterol anomalies',
          'Is my fasting glucose dangerous?',
          'What exercises help my HDL?',
        ].map((item) => (
          <button
            key={item}
            onClick={() => handleSend(item)}
            className="text-[10px] font-semibold border border-[#182737] hover:border-[#dfc2b0] px-3 py-1.5 rounded-full text-gray-400 hover:text-white cursor-pointer transition-all bg-[#13202e] active:scale-[0.97]"
          >
            {item}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="p-4 border-t border-[#182737] flex items-center gap-2 bg-[#091018]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Auriem AI about your clinical laboratory report insights..."
          className="flex-1 text-xs border border-[#182737] p-3 rounded-xl bg-[#0d1721] text-white focus:outline-none focus:border-[#dfc2b0] focus:ring-1 focus:ring-[#dfc2b0]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button
          onClick={() => handleSend()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#1c1917] cursor-pointer shadow hover:opacity-90 active:scale-[0.95] transition-all shrink-0"
          style={{ background: '#dfc2b0' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
