import { useState, useEffect, useRef } from 'react';
import { Lightbulb, Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
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
      content: `Hello! I am Auriem's clinical diagnostics assistant. I've finished analyzing your laboratory work. 
      
      I noticed **${biomarkers.filter(b => b.status !== 'NORMAL').length} flagged biomarkers**. Let me know what questions you have about your cholesterol, glucose ranges, or specific dietary recommendations!`,
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
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const abnormalities = biomarkers
        .filter((b) => b.status !== 'NORMAL')
        .map((b) => `- ${b.displayName}: ${b.value} ${b.unit} (Ref: ${b.referenceRange} - ${b.status})`)
        .join('\n');

      console.log('Sending message to clinical model context:', patient, abnormalities);

      // Simulating response based on clinical parameters
      setTimeout(() => {
        let answer = '';
        if (userText.toLowerCase().includes('cholesterol') || userText.toLowerCase().includes('lipid')) {
          answer = `Your **Total Cholesterol (${biomarkers.find(b => b.canonicalName === 'CHOLESTEROL_TOTAL')?.value || 210} mg/dL)** is elevated above the standard reference maximum of 200 mg/dL. 
          
### Clinical Recommendations:
1. **Dietary Shifts:** Integrate Mediterranean nutrition elements. Increase soluble fiber (oats, beans) which binds cholesterol in your digestive tract and aids excretion.
2. **Increase Healthy Fats:** Consume avocados, olive oil, and almonds while cutting trans/saturated fats.
3. **Cardio Activity:** Strive for 30 minutes of aerobic activity (jogging, brisk cycling) 5 times per week.`;
        } else if (userText.toLowerCase().includes('glucose') || userText.toLowerCase().includes('sugar')) {
          answer = `Your **Fasting Blood Glucose (${biomarkers.find(b => b.canonicalName === 'GLUCOSE')?.value || 105.5} mg/dL)** falls slightly high, placing you in a pre-diabetic monitoring vector.
 
### Action Plan:
- **Cut Simple Carbohydrates:** Reduce white bread, sodas, and heavy sucrose additives.
- **Support Metabolic Regulation:** Ensure adequate physical strength/weight training to increase skeletal muscle glucose uptake.
- **Check HbA1c:** Discuss a 3-month HbA1c diagnostic panel with your practitioner to evaluate long-term insulin efficacy.`;
        } else {
          answer = `Based on your recent lab results, your vital clinical readings represent high metabolic stability. However, keeping physical cardiovascular workouts regular will further improve lipid profiles. 
 
Let me know if there's a specific biomarker panel (CBC, Lipid Panel, CMP) you'd like me to explain!`;
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
        setLoading(false);
      }, 1200);

    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Apologies, my clinical communications link timed out. Please try asking again.' },
      ]);
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col h-[600px] bg-card">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between" style={{ background: 'var(--card)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-glow)' }}>
            <Lightbulb className="w-4.5 h-4.5 text-[var(--primary-text)]" />
          </div>
          <div>
            <h5 className="text-sm font-bold text-foreground">AI Clinical Assistant</h5>
            <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              Online Diagnostic Consultation
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar">
        {messages.map((msg, idx) => {
          const isAI = msg.role === 'assistant';
          return (
            <div
              key={idx}
              className={cn(
                'max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed',
                isAI
                  ? 'bg-card border border-border/50 text-foreground self-start rounded-tl-none shadow-sm'
                  : 'text-white self-end rounded-tr-none shadow'
              )}
              style={{
                background: isAI ? undefined : 'var(--primary-text)',
              }}
            >
              {isAI ? (
                <div className="prose prose-sm dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="bg-card border border-border/50 text-muted-foreground self-start rounded-2xl rounded-tl-none p-4 flex items-center gap-2.5 text-xs shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--primary-text)]" />
            <span>Analyzing diagnostic parameters...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggestions */}
      <div className="px-6 py-2 flex flex-wrap gap-2 border-t border-border/30 bg-border/5">
        {[
          'Explain my cholesterol anomalies',
          'Is my fasting glucose dangerous?',
          'What exercises help my HDL?',
        ].map((item) => (
          <button
            key={item}
            onClick={() => handleSend(item)}
            className="text-[10px] font-semibold border border-border/50 hover:border-[var(--primary)] px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground cursor-pointer transition-all bg-card"
          >
            {item}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="p-4 border-t border-border/40 flex items-center gap-2" style={{ background: 'var(--card)' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Auriem AI about your clinical laboratory report insights..."
          className="flex-1 text-xs border border-border/60 p-3 rounded-xl bg-card text-foreground"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button
          onClick={() => handleSend()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white cursor-pointer shadow hover:opacity-90 transition-opacity"
          style={{ background: 'var(--primary-text)' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
