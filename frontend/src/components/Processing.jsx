import { useEffect, useState, useRef } from 'react';
import API_BASE from '../api';
import { Terminal, Cpu, Square, ArrowRight } from 'lucide-react';

export default function Processing({ setTab, setBatchId }) {
  const [progress, setProgress] = useState({
    running: false,
    total: 0,
    completed: 0,
    failed: 0,
    status: 'Idle',
    active_file: '',
    logs: [],
    batch_id: null
  });
  
  const [cancelling, setCancelling] = useState(false);
  const consoleContainerRef = useRef(null);

  useEffect(() => {
    let interval = null;
    fetchProgress();
    interval = setInterval(() => {
      fetchProgress();
    }, 800);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [progress.logs]);

  const fetchProgress = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/batch/progress`);
      if (res.ok) {
        const data = await res.json();
        setProgress(data);
        if (data.batch_id) {
          setBatchId(data.batch_id);
        }
      }
    } catch (err) {
      console.error("Error polling progress details:", err);
    }
  };

  const handleCancelRun = async () => {
    const confirmCancel = window.confirm("Are you sure you want to stop the billing automation run midway?");
    if (!confirmCancel) return;

    setCancelling(true);
    try {
      const res = await fetch(`${API_BASE}/api/batch/cancel`, { method: 'POST' });
      if (res.ok) {
        fetchProgress();
      }
    } catch (err) {
      console.error("Cancel API call failed:", err);
    } finally {
      setCancelling(false);
    }
  };

  const handleViewResults = () => {
    setTab('results');
  };

  const totalProcessed = progress.completed + progress.failed;
  const progressPercent = progress.total > 0 ? Math.round((totalProcessed / progress.total) * 100) : 0;
  const isFinished = !progress.running && totalProcessed > 0;

  const getLogColorClass = (type) => {
    switch (type) {
      case 'success': return 'text-secondary font-semibold';
      case 'error': return 'text-error font-semibold';
      case 'warning': return 'text-amber-400';
      case 'debug': return 'text-on-surface-variant/50';
      default: return 'text-on-surface';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in z-10">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline-xl">Billing Engine</h2>
        <p className="mt-1 text-sm text-on-surface-variant">The batch calculation engine is active, generating PDFs via local win32com and ReportLab fallbacks.</p>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Progress bar container */}
        <div className="lg:col-span-3 glass-panel rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-on-surface flex items-center gap-2">
              {progress.running ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
              ) : null}
              Status: <span className="text-primary font-bold">{progress.status}</span>
            </span>
            <span className="text-on-surface-variant font-mono">{progressPercent}% ({totalProcessed} / {progress.total} files)</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-full h-4 overflow-hidden p-0.5">
            <div 
              className="bg-[#0082f6] h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-on-surface-variant font-medium">
            <span>Successful: <strong className="text-secondary">{progress.completed}</strong></span>
            <span>Failed: <strong className="text-error">{progress.failed}</strong></span>
            <span className="font-mono truncate max-w-xs sm:max-w-sm">Active File: <span className="text-on-surface">{progress.active_file || 'None'}</span></span>
          </div>
        </div>

        {/* Control Button panel */}
        <div className="glass-panel rounded-xl p-6 flex flex-col justify-center items-center">
          {progress.running ? (
            <button
              onClick={handleCancelRun}
              disabled={cancelling}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold bg-error/10 hover:bg-error/20 border border-error/20 text-error transition-colors cursor-pointer active:scale-95"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              {cancelling ? 'Stopping...' : 'Cancel Execution'}
            </button>
          ) : isFinished ? (
            <button
              onClick={handleViewResults}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer active:scale-95"
            >
              View Results
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="text-center text-xs text-on-surface-variant">
              <Cpu className="h-6 w-6 text-outline mx-auto mb-2" />
              Engine Idle
            </div>
          )}
        </div>
      </div>

      {/* Terminal Logs console */}
      <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-surface-container/20 border-b border-[#232d3f]/60 flex items-center justify-between">
          <h3 className="text-xs font-bold text-on-surface flex items-center gap-2 uppercase tracking-wider">
            <Terminal className="h-4 w-4 text-primary" />
            Live Execution Console Logs
          </h3>
          <span className="text-[10px] font-mono text-on-surface-variant">Auto-Scroll Active</span>
        </div>

        <div 
          ref={consoleContainerRef}
          className="bg-surface-lowest p-6 h-[400px] overflow-y-auto border border-[#232d3f]/30 rounded-b-xl font-mono text-xs leading-relaxed space-y-1.5 scrollbar-thin"
        >
          {progress.logs.length > 0 ? (
            progress.logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-on-surface-variant/30 flex-shrink-0 select-none">[{log.timestamp}]</span>
                <span className={getLogColorClass(log.type)}>{log.message}</span>
              </div>
            ))
          ) : (
            <div className="text-on-surface-variant/30 italic">Waiting for compiler logs stream...</div>
          )}
        </div>
      </div>
    </div>
  );
}
