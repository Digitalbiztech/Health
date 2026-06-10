import { useState, useEffect, useRef } from 'react';
import { Loader2, Send, User, RotateCcw, MessageSquare, Plus, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { sendChatMessage, getChatHistory, createChatSession, getChatSessions, type ChatSessionPayload } from '@/lib/api';
import type { Biomarker, PatientRecord } from '@/types/dashboard';
import { useAuth } from '@/contexts/AuthContext';

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

  const { principal } = useAuth();
  const isDoctor = principal?.accountType === 'STAFF';

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
        isDoctor ? (
          <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h6 className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary-text)]">Clinician Tools</h6>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-[var(--primary-text)] font-semibold">Active Session</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Copy clinical findings directly to your clipboard or download the full patient PDF summary.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(mainContent.trim());
                  alert("Clinical note copied to clipboard!");
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-[var(--primary-text)] text-white text-[10px] font-bold shadow hover:opacity-90 active:scale-[0.97] transition-all border-0 cursor-pointer"
              >
                Copy Clinical Note
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
        ) : (
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
        )
      )}
    </div>
  );
}

export function AIChat({ biomarkers, patient }: ChatProps) {
  const { principal } = useAuth();
  const isDoctor = principal?.accountType === 'STAFF';

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionPayload[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat sessions list
  async function loadSessions() {
    try {
      const data = await getChatSessions(patient?.id);
      setSessions(data);
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  }

  // Load persistent history on mount/patient change
  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await getChatHistory(patient?.id);
        if (history.messages && history.messages.length > 0) {
          setMessages(history.messages);
        } else {
          // No history, set the default greeting!
          const greeting = isDoctor
            ? `Hello Doctor. I am your Clinical Diagnostic co-pilot. I can help analyze this patient's report, track longitudinal biomarker trends, and reference medical guidelines. How can I assist you with this patient's case today?`
            : `Hello! I am your Personalized Medical Care chat agent. I can review your lab results, analyze trends, and even read medical flowcharts or guidelines if you upload them. How can I help you today?`;
          setMessages([{ role: 'assistant', content: greeting }]);
        }
        if (history.sessionId) {
          setSessionId(history.sessionId);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    }
    loadHistory();
    loadSessions();
  }, [patient?.id, isDoctor]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load a specific session's history
  async function selectSession(selectedSessionId: string) {
    if (loading) return;
    setLoading(true);
    try {
      const history = await getChatHistory(patient?.id, selectedSessionId);
      setSessionId(selectedSessionId);
      if (history.messages && history.messages.length > 0) {
        setMessages(history.messages);
      } else {
        const greeting = isDoctor
          ? `Hello Doctor. I've loaded this clinical consultation thread. How can I assist you with this patient's case today?`
          : `Hello! I've loaded this consultation thread. How can I help you analyze your lab reports today?`;
        setMessages([{ role: 'assistant', content: greeting }]);
      }
    } catch (err) {
      console.error('Failed to load session history:', err);
    } finally {
      setLoading(false);
    }
  }

  // Start a fresh consultation thread
  async function handleNewSession() {
    if (loading) return;
    setLoading(true);
    try {
      const { sessionId: newSessionId } = await createChatSession(patient?.id);
      setSessionId(newSessionId);
      const greeting = isDoctor
        ? `Hello Doctor. I've started a new clinical consultation thread for this patient. How can I help you analyze their lab reports today?`
        : `Hello! I've started a new clinical consultation thread for you. How can I help you analyze your lab reports today?`;
      setMessages([
        {
          role: 'assistant',
          content: greeting,
        },
      ]);
      await loadSessions();
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
      await loadSessions();
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
    <div className="rounded-2xl border border-border shadow-md overflow-hidden flex bg-card animate-fade-in w-full min-h-[600px]">
      {/* Sidebar - Past Chat Sessions */}
      {sidebarOpen && (
        <div className="w-64 border-r border-border bg-muted/10 flex flex-col shrink-0 transition-all duration-300">
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Chat History
            </span>
            <button
              onClick={handleNewSession}
              disabled={loading}
              className="p-1 rounded-lg border border-border hover:border-primary bg-background text-muted-foreground hover:text-primary transition-all active:scale-[0.95] cursor-pointer"
              title="New Thread"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[500px]">
            {sessions.map((s) => {
              const isActive = s.id === sessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all duration-200 flex flex-col gap-1 cursor-pointer border",
                    isActive
                      ? "bg-primary/5 border-primary/20 text-[var(--primary-text)] font-semibold shadow-sm"
                      : "bg-transparent border-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="truncate block font-medium w-full">{s.title || "Untitled Session"}</span>
                  <span className="text-[9px] opacity-60">
                    {new Date(s.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </button>
              );
            })}
            {sessions.length === 0 && (
              <div className="text-center py-8 text-[11px] text-muted-foreground">
                No past sessions
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer bg-transparent border-0 outline-none"
              title="Toggle sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-full border border-border flex items-center justify-center font-serif text-sm font-bold text-[var(--primary-text)] bg-background shrink-0 select-none shadow-inner">
              C
            </div>
            <div>
              <h5 className="text-[11px] font-bold tracking-wider text-[var(--primary-text)] uppercase">
                {isDoctor ? 'Clinical AI Co-Pilot' : 'Personalized Medical Care'}
              </h5>
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
            {(isDoctor
              ? [
                  'Analyze longitudinal biomarker trends',
                  'What guidelines exist for critical HbA1c?',
                  'Differential diagnosis for elevated ALT',
                  'Review lipid profile and cardiovascular risk',
                ]
              : [
                  'Explain my cholesterol anomalies',
                  'Is my fasting glucose dangerous?',
                  'What exercises help my HDL?',
                ]
            ).map((item) => (
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
            placeholder={
              isDoctor
                ? "Ask Auriem AI about clinical insights, trends, or guidelines for this patient..."
                : "Ask Auriem AI about your clinical laboratory report insights..."
            }
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
    </div>
  );
}

