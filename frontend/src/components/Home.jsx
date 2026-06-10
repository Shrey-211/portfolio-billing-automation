import { useState, useEffect } from 'react';
import API_BASE from '../api';
import { 
  FolderOpen, 
  Clock, 
  ArrowRight, 
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Play,
  TrendingDown,
  Percent
} from 'lucide-react';

export default function Home({ setTab, setQueue, setFolderPath, folderPath, queue, setImportMode }) {
  const [loading, setLoading] = useState(false);
  const [recentBatches, setRecentBatches] = useState([]);
  const [stats, setStats] = useState({
    totalBatches: 0,
    successfulFiles: 0,
    failedFiles: 0,
    successRate: 100,
    totalValuation: 0.0,
    netBilling: 0.0
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecentBatches();
  }, []);

  const fetchRecentBatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/batch/recent`);
      if (res.ok) {
        const data = await res.json();
        setRecentBatches(data);
        
        if (data.length > 0) {
          const total = data.length;
          let success = 0;
          let failed = 0;
          
          data.forEach(b => {
            success += b.processed_files || 0;
            failed += b.failed_files || 0;
          });
          
          const totalFiles = success + failed;
          const rate = totalFiles > 0 ? Math.round((success / totalFiles) * 100) : 100;
          
          setStats({
            totalBatches: total,
            successfulFiles: success,
            failedFiles: failed,
            successRate: rate
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch recent batches", err);
    }
  };

  const handleSelectFolder = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/folders/select`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(await res.text() || "Failed to open folder picker.");
      }
      const data = await res.json();
      if (data.folder_path) {
        setFolderPath(data.folder_path);
        setQueue(data.files || []);
        setImportMode('folder');
      }
    } catch (err) {
      setError(err.message || 'Failed to select folder.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExcelSheet = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/excel/select`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(await res.text() || "Failed to open file picker.");
      }
      const data = await res.json();
      if (data.excel_path) {
        setFolderPath(data.folder_path); // Use folder containing Excel for output pdfs
        setQueue(data.files || []);
        setImportMode('sheet');
      }
    } catch (err) {
      setError(err.message || 'Failed to select Excel file.');
    } finally {
      setLoading(false);
    }
  };


  const handleLoadToWorkbench = () => {
    if (queue.length > 0) {
      setTab('workbench');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative z-10">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline-xl">Portfolio Overview</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Real-time billing telemetry and asset tracking.</p>
        </div>
        <div className="glass-panel rounded-lg px-4 py-2 flex items-center gap-2 text-on-surface text-xs font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          <span>Q3 (OCT - DEC)</span>
        </div>
      </div>

      {/* Metrics Row - Precision Glass Fintech Bento Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1: AUM */}
        <div className="glass-panel rounded-xl p-6 flex flex-col relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Assets Under Management</p>
            <TrendingUp className="h-4 w-4 text-primary opacity-60" />
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="font-mono text-2xl font-extrabold text-on-surface tracking-tight">₹452.8 Cr</h3>
            <span className="font-mono text-[11px] text-secondary font-bold flex items-center">
              +4.2%
            </span>
          </div>
          {/* Abstract Sparkline Overlay from Stitch Design */}
          <div className="absolute bottom-0 left-0 w-full h-10 opacity-10 pointer-events-none bg-gradient-to-t from-primary/20 to-transparent" style={{ clipPath: "polygon(0 100%, 0 60%, 20% 70%, 40% 40%, 60% 80%, 80% 30%, 100% 50%, 100% 100%)" }}></div>
        </div>

        {/* Metric 2: Net Billing */}
        <div className="glass-panel rounded-xl p-6 flex flex-col relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Net Billing (Q3)</p>
            <Percent className="h-4 w-4 text-primary opacity-60" />
          </div>
          <h3 className="font-mono text-2xl font-extrabold text-on-surface tracking-tight">₹1.24 Cr</h3>
          <div className="w-full bg-surface-variant h-1 rounded-full overflow-hidden mt-3">
            <div className="bg-primary h-full w-[65%] rounded-full"></div>
          </div>
        </div>

        {/* Metric 3: GST */}
        <div className="glass-panel rounded-xl p-6 flex flex-col relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">GST Collected</p>
            <CheckCircle className="h-4 w-4 text-secondary opacity-60" />
          </div>
          <h3 className="font-mono text-2xl font-extrabold text-on-surface tracking-tight">₹22.32 L</h3>
          <div className="mt-2 flex items-center gap-1.5 text-secondary">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
            <span className="text-[10px] font-bold tracking-wide">Ready for remittance</span>
          </div>
        </div>

        {/* Metric 4: Success Rate */}
        <div className="glass-panel rounded-xl p-6 flex flex-col relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Success Rate</p>
            <CheckCircle className="h-4 w-4 text-secondary opacity-60" />
          </div>
          <h3 className="font-mono text-2xl font-extrabold text-on-surface tracking-tight">{stats.successRate}%</h3>
          <div className="mt-2 flex items-center gap-1 text-on-surface-variant">
            <span className="text-[10px] font-bold tracking-wide uppercase">stable ({stats.totalBatches} runs)</span>
          </div>
        </div>

      </div>

      {/* Main Ingest & History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Data Ingestion Card */}
        <div className="lg:col-span-1 bg-surface-container/40 glass-panel rounded-xl p-6 flex flex-col justify-between relative overflow-hidden min-h-[340px] group hover:border-primary/50 transition-colors duration-300">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center border border-outline-variant/30">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Data Ingestion</h3>
                <p className="text-xs text-on-surface-variant">Ready for processing</p>
              </div>
            </div>

            {folderPath ? (
              <div className="space-y-4">
                <div className="bg-surface-lowest/70 border border-outline-variant/40 rounded-lg p-4 font-mono text-[10px] text-primary break-all">
                  <p className="text-[8px] text-on-surface-variant font-bold mb-1 uppercase tracking-wider">Current Directory</p>
                  {folderPath}
                </div>
                <div className="flex items-center justify-between bg-surface-lowest/70 border border-outline-variant/40 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    <span className="text-xs font-semibold text-on-surface">Files Detected</span>
                  </div>
                  <span className="text-lg font-bold text-on-surface font-mono">{queue.length}</span>
                </div>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-outline-variant/60 bg-surface-lowest/20 rounded-lg text-center">
                <p className="text-xs text-on-surface-variant">No billing directory selected yet.</p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-error-container/10 border border-error-container/20 rounded-lg flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-error mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-error leading-normal">{error}</p>
              </div>
            )}
          </div>

          <div className="mt-6 relative z-10">
            {folderPath && queue.length > 0 ? (
              <div className="space-y-3">
                <button
                  onClick={handleLoadToWorkbench}
                  className="w-full bg-primary text-on-primary hover:bg-primary/90 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/10 cursor-pointer active:scale-95"
                >
                  Configure Queue & Run
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setFolderPath('');
                    setQueue([]);
                  }}
                  className="w-full bg-surface-lowest text-on-surface hover:bg-surface-container-high py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all border border-outline-variant/30 cursor-pointer active:scale-95"
                >
                  Reset Ingest Source
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleSelectFolder}
                  disabled={loading}
                  className="w-full bg-primary text-on-primary hover:bg-primary/90 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/10 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Opening Dialog...' : (
                    <>
                      <FolderOpen className="h-4 w-4" />
                      Scan Folder (Multi-file)
                    </>
                  )}
                </button>
                <button
                  onClick={handleSelectExcelSheet}
                  disabled={loading}
                  className="w-full bg-surface-lowest text-on-surface hover:bg-surface-container-high py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all border border-outline-variant/30 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Opening Dialog...' : (
                    <>
                      <FolderOpen className="h-4 w-4 text-primary" />
                      Import Billing Sheet (Single-sheet)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Batch History Grid */}
        <div className="lg:col-span-2 glass-panel rounded-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#232d3f]/60 flex justify-between items-center bg-surface-container/20">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-on-surface-variant" />
              Recent Batch History
            </h3>
            <button 
              onClick={fetchRecentBatches}
              className="text-xs text-primary hover:text-primary-fixed transition-colors font-semibold cursor-pointer"
            >
              Refresh
            </button>
          </div>
          
          <div className="overflow-x-auto flex-1">
            {recentBatches.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-lowest/70 border-b border-[#232d3f]/40">
                    <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Batch ID</th>
                    <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Date & Time</th>
                    <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Processed</th>
                    <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Failed</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-on-surface divide-y divide-[#232d3f]/20">
                  {recentBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-surface-container-highest/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-primary">#B-{batch.id}</td>
                      <td className="py-4 px-6 text-on-surface-variant font-mono">
                        {new Date(batch.timestamp.replace(' ', 'T')).toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                          batch.status === 'Completed' ? 'bg-secondary/10 text-secondary border-secondary/20' : 
                          batch.status === 'Running' ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' :
                          batch.status === 'Partially Completed' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-error-container/10 text-error border-error-container/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            batch.status === 'Completed' ? 'bg-secondary' :
                            batch.status === 'Running' ? 'bg-primary animate-ping' :
                            batch.status === 'Partially Completed' ? 'bg-amber-400' :
                            'bg-error'
                          }`}></span>
                          {batch.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-secondary font-bold">{batch.processed_files}</td>
                      <td className="py-4 px-6 text-center font-mono text-error font-bold">{batch.failed_files}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-16 text-center">
                <Clock className="h-10 w-10 text-outline mx-auto mb-3" />
                <p className="text-xs text-on-surface-variant">No run history found.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
