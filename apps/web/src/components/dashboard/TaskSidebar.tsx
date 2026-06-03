import { useState } from 'react';
import { ListTodo, Plus, CheckCircle2, Circle, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskRecord } from '@/types/dashboard';
import { PRIORITY_COLORS } from './constants';

interface TaskSidebarProps {
  tasks: TaskRecord[];
  loading: boolean;
  onCreate: (payload: { title: string; priority: TaskRecord['priority']; dueDate?: string }) => void;
  onToggle: (task: TaskRecord) => void;
  onDelete: (id: string) => void;
}

export function TaskSidebar({ tasks, loading, onCreate, onToggle, onDelete }: TaskSidebarProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskRecord['priority']>('MEDIUM');
  const [filter, setFilter] = useState<'open' | 'done'>('open');

  const visible = tasks.filter((t) => (filter === 'open' ? t.status !== 'DONE' : t.status === 'DONE'));
  const openCount = tasks.filter((t) => t.status !== 'DONE').length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreate({ title: newTitle.trim(), priority: newPriority });
    setNewTitle('');
    setNewPriority('MEDIUM');
  }

  return (
    <div className="glass-card rounded-2xl p-4 border-border/40 shadow-sm flex flex-col gap-3 max-h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-[#8a7a6a]" />
          Tasks
        </h4>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4BDAD]/15 text-[#8a7a6a]">
          {openCount} open
        </span>
      </div>

      {/* Add task */}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task..."
          className="w-full text-xs rounded-xl px-3 py-2 outline-none border border-border/60 bg-card text-foreground focus:border-[#D4BDAD] transition-colors"
        />
        <div className="flex items-center gap-2">
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as TaskRecord['priority'])}
            className="flex-1 text-[11px] rounded-lg px-2 py-1.5 outline-none border border-border/60 bg-card text-foreground cursor-pointer"
          >
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <button
            type="submit"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 cursor-pointer shadow hover:opacity-90"
            style={{ background: '#8a7a6a' }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Filter toggle */}
      <div className="flex gap-1 p-1 rounded-lg border border-border/40" style={{ background: 'var(--card)' }}>
        {(['open', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-1 py-1 rounded-md text-[11px] font-semibold capitalize transition-all cursor-pointer',
              filter === f ? 'bg-[#D4BDAD]/15 text-[#8a7a6a]' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[#8a7a6a]" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6">
            {filter === 'open' ? 'No open tasks. Nice work!' : 'No completed tasks yet.'}
          </p>
        ) : (
          visible.map((task) => {
            const done = task.status === 'DONE';
            return (
              <div
                key={task.id}
                className="group p-2.5 rounded-xl border border-border/40 bg-card/65 flex items-start gap-2.5 hover:border-[#D4BDAD]/50 transition-colors"
              >
                <button
                  onClick={() => onToggle(task)}
                  className="mt-0.5 shrink-0 cursor-pointer"
                  title={done ? 'Mark as open' : 'Mark as done'}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1A9966]" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground hover:text-[#8a7a6a]" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium text-foreground break-words', done && 'line-through opacity-60')}>
                    {task.title}
                  </p>
                  {task.patient && (
                    <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                      {task.patient.firstName} {task.patient.lastName}
                    </p>
                  )}
                </div>
                <span
                  className="w-2 h-2 rounded-full mt-1 shrink-0"
                  style={{ background: PRIORITY_COLORS[task.priority] }}
                  title={`${task.priority} priority`}
                />
                <button
                  onClick={() => onDelete(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#D41717] cursor-pointer transition-all shrink-0"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
