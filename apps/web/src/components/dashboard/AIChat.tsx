import { useState, useEffect, useRef } from 'react';
import { Loader2, Send, User, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { sendChatMessage, getChatHistory, createChatSession } from '@/lib/api';
import type { Biomarker, PatientRecord } from '@/types/dashboard';

interface ChatProps {
  biomarkers: Biomarker[];
  patient?: PatientRecord;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function AIMessageBubble({ content }: { content: string }) {
  const [refsOpen, setRefsOpen] = useState(false);

  const parts = content.split('### 📚 Scientific References & Research');
  const mainContent = parts[0];
  const referencesContent = parts[1];

  const isClinical = content.toLowerCase().includes('discuss') || 
                     content.toLowerCase().includes('recommend') ||
                     content.toLowerCase().includes('physician') ||
                     content.toLowerCase().includes('provider') ||
                     content.toLowerCase().includes('references');

  const customComponents = {
    h3: ({ children, ...props }: any) => (
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary-text)] mt-4 mb-2 flex items-center gap-1.5" {...props}>
        <span className="w-1 h-3 rounded-full bg-[var(--primary-text)]" />
        {children}
      </h3>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 my-2 list-none p-0" {...props}>
        {children}
      </ul>
    ),
    li: ({ children, ...props }: any) => (
      <li className="bg-muted/30 hover:bg-muted/50 p-2.5 rounded-xl border border-border/40 text-[11px] text-foreground leading-relaxed flex items-start gap-2 transition-all" {...props}>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-text)] mt-1.5 shrink-0" />
        <div>{children}</div>
      </li>
    ),
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/10 dark:prose-pre:bg-black/30 text-foreground font-sans">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={customComponents}>
          {mainContent}
        </ReactMarkdown>
      </div>

      {referencesContent && (
        <div className="mt-3 border-t border-border/60 pt-2.5">
          <button
            onClick={() => setRefsOpen(!refsOpen)}
            className="flex items-center justify-between w-full text-[9px] font-bold text-muted-foreground hover:text-[var(--primary-text)] transition-all uppercase tracking-wider py-1 cursor-pointer bg-transparent border-0 outline-none"
          >
            <span className="flex items-center gap-1">
              📚 Scientific References ({referencesContent.split('\n').filter(l => l.trim().startsWith('-')).length})
            </span>
            <span>{refsOpen ? 'Hide' : 'Show'}</span>
          </button>
          {refsOpen && (
            <div className="mt-2 text-[10px] text-muted-foreground space-y-1.5 animate-fade-in border border-border/40 p-2.5 rounded-xl bg-muted/20">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {referencesContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {isClinical && (
        <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h6 className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary-text)]">Actionable Next Steps</h6>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-[var(--primary-text)] font-semibold">Recommended</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Review these results with your healthcare provider to establish a personalized health optimization plan.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => alert("Appointment Scheduler: In production, this launches your portal scheduling system.")}
              className="flex-1 py-2 px-3 rounded-lg bg-[var(--primary-text)] text-white text-[10px] font-bold shadow hover:opacity-90 active:scale-[0.97] transition-all border-0 cursor-pointer"
            >
              Schedule Appointment
            </button>
            <button 
              onClick={() => {
                const exportBtn = document.querySelector('[class*="export"]') as HTMLButtonElement;
                if (exportBtn) {
                  exportBtn.click();
                } else {
                  alert("Downloading patient clinical report summary PDF...");
                }
              }}
              className="flex-1 py-2 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-[10px] font-bold active:scale-[0.97] transition-all cursor-pointer"
            >
              Download PDF Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AIChat({ biomarkers, patient }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I am your Personalized Medical Care chat agent. I can review your lab results, analyze trends, and even read medical flowcharts or guidelines if you upload them. How can I help you today?`,
    },
  ]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load persistent history on mount/patient change
  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await getChatHistory(patient?.id);
        if (history.messages && history.messages.length > 0) {
          setMessages(history.messages);
        }
        if (history.sessionId) {
          setSessionId(history.sessionId);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    }
    loadHistory();
  }, [patient?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start a fresh consultation thread
  async function handleNewSession() {
    if (loading) return;
    setLoading(true);
    try {
      const { sessionId: newSessionId } = await createChatSession(patient?.id);
      setSessionId(newSessionId);
      setMessages([
        {
          role: 'assistant',
          content: `Hello! I've started a new clinical consultation thread for you. How can I help you analyze your lab reports today?`,
        },
      ]);
    } catch (err) {
      console.error('Failed to start new session:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(textToSend = input) {
    if (!textToSend.trim() || loading) return;

    const userText = textToSend;
    setInput('');
    const nextMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const { reply, sessionId: returnedSessionId } = await sendChatMessage({
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
        patientId: patient?.id,
        sessionId: sessionId || undefined,
      });

      if (returnedSessionId) {
        setSessionId(returnedSessionId);
      }
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
    <div className="rounded-2xl border border-border shadow-md overflow-hidden flex flex-col bg-card animate-fade-in w-full min-h-[500px]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-border flex items-center justify-center font-serif text-sm font-bold text-[var(--primary-text)] bg-background shrink-0 select-none shadow-inner">
            C
          </div>
          <div>
            <h5 className="text-[11px] font-bold tracking-wider text-[var(--primary-text)] uppercase">Personalized Medical Care</h5>
            <p className="text-[10px] text-muted-foreground flex items-center mt-0.5 font-medium">
              chat agent
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full mx-1.5 animate-pulse" />
              <span className="text-[#10b981] font-semibold">Online</span>
            </p>
          </div>
        </div>

        {/* Start new session action */}
        <button
          onClick={handleNewSession}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] font-bold border border-border hover:border-[var(--primary-text)] px-3 py-1.5 rounded-lg text-muted-foreground hover:text-[var(--primary-text)] transition-all bg-background/50 hover:bg-background active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          New Thread
        </button>
      </div>

      {/* Messages */}
      <div className="p-6 flex flex-col gap-6 bg-background">
        {messages.map((msg, idx) => {
          const isAI = msg.role === 'assistant';
          return (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-3 w-full',
                isAI ? 'justify-start' : 'flex-row-reverse'
              )}
            >
              {/* Avatar */}
              {isAI ? (
                <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-[var(--primary-glow)] shrink-0 font-serif text-xs font-bold text-[var(--primary-text)] select-none shadow-md">
                  C
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-muted/50 shrink-0 text-[var(--primary-text)] select-none shadow-md">
                  <User className="w-4 h-4" />
                </div>
              )}

              {/* Bubble */}
              <div
                className={cn(
                  'rounded-2xl p-4 text-xs leading-relaxed shadow-sm transition-all duration-200',
                  isAI
                    ? 'bg-muted/30 border border-border/80 text-foreground rounded-tl-none max-w-[650px] w-full'
                    : 'bg-[var(--primary-text)] text-white rounded-tr-none font-medium max-w-[85%]'
                )}
              >
                {isAI ? (
                  <AIMessageBubble content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex items-start gap-3 w-full justify-start animate-pulse">
            <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-[var(--primary-glow)] shrink-0 font-serif text-xs font-bold text-[var(--primary-text)] select-none shadow-md">
              C
            </div>
            <div className="bg-muted/30 border border-border/80 text-muted-foreground rounded-2xl rounded-tl-none p-4 flex items-center gap-2.5 text-xs shadow-sm max-w-[650px] w-full">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--primary-text)]" />
              <span>Analyzing diagnostic parameters...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Centered Suggestions Pills */}
      <div className="px-6 py-3 border-t border-border bg-card flex flex-col items-center gap-2">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold">Suggested Questions</span>
        <div className="flex flex-wrap justify-center gap-2 max-w-lg">
          {[
            'Explain my cholesterol anomalies',
            'Is my fasting glucose dangerous?',
            'What exercises help my HDL?',
          ].map((item) => (
            <button
              key={item}
              onClick={() => handleSend(item)}
              className="text-[10px] font-semibold border border-border hover:border-[var(--primary-text)] px-3.5 py-1.5 rounded-full text-muted-foreground hover:text-[var(--primary-text)] cursor-pointer transition-all bg-background/50 hover:bg-background active:scale-[0.97] hover:shadow-sm"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="p-4 border-t border-border flex items-center gap-2 bg-card">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Auriem AI about your clinical laboratory report insights..."
          className="flex-1 text-xs border border-border p-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--primary-text)] focus:ring-1 focus:ring-[var(--primary-text)]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button
          onClick={() => handleSend()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-[var(--primary-text)] cursor-pointer shadow hover:opacity-90 active:scale-[0.95] transition-all shrink-0 border-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

