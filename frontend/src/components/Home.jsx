import { useState, useEffect, useRef } from 'react';
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

export default function Home({ setTab, setQueue, setFolderPath, folderPath, queue, setImportMode, sheetType, setSheetType }) {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [manualPath, setManualPath] = useState('');
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

  const handleScanManualPath = async (targetPath) => {
    const pathToScan = (targetPath !== undefined ? targetPath : manualPath).trim();
    if (!pathToScan) {
      setError("Please enter a valid directory or Excel file path.");
      return;
    }
    setScanLoading(true);
    setError('');
    try {
      const isExcel = pathToScan.endsWith('.xlsx') || pathToScan.endsWith('.xlsm');
      const endpoint = isExcel ? `${API_BASE}/api/excel/scan` : `${API_BASE}/api/folders/scan`;
      const body = isExcel ? { excel_path: pathToScan } : { folder_path: pathToScan };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Path could not be scanned. Please check that the path exists.");
      }
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        setFolderPath(data.folder_path || pathToScan);
        setQueue(data.files || []);
        setImportMode(isExcel ? 'sheet' : 'folder');
      } else {
        setError("No portfolio workbooks (.xlsx/.xlsm) found in that directory.");
      }
    } catch (err) {
      setError(err.message || "Failed to scan specified path.");
    } finally {
      setScanLoading(false);
    }
  };

  const handleBrowserFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleBrowserFolderClick = () => {
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
      folderInputRef.current.click();
    }
  };

  const handleBrowserFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSheetLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/api/excel/upload`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to upload and parse Excel sheet.");
      }
      const data = await res.json();
      if (data.excel_path && data.files) {
        setFolderPath(data.folder_path);
        setQueue(data.files || []);
        setImportMode('sheet');
      } else {
        throw new Error("No client billing rows recognized in the uploaded sheet.");
      }
    } catch (err) {
      setError(err.message || 'Failed to process Excel file.');
    } finally {
      setSheetLoading(false);
    }
  };

  const handleBrowserFolderChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setFolderLoading(true);
    setError('');
    try {
      const formData = new FormData();
      let excelFilesCount = 0;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.name.endsWith('.xlsx') || f.name.endsWith('.xlsm')) {
          formData.append('files', f);
          excelFilesCount++;
        }
      }

      if (excelFilesCount === 0) {
        throw new Error("No .xlsx or .xlsm files found in selected folder.");
      }

      const res = await fetch(`${API_BASE}/api/folders/upload`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to upload and scan portfolio folder.");
      }
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        setFolderPath(data.folder_path);
        setQueue(data.files || []);
        setImportMode('folder');
      } else {
        throw new Error("No valid portfolio files recognized in the folder.");
      }
    } catch (err) {
      setError(err.message || 'Failed to process folder.');
    } finally {
      setFolderLoading(false);
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container/30 glass-panel rounded-xl p-4 border border-outline-variant/10">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Batches</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-on-surface">{stats.totalBatches}</div>
          <p className="text-[10px] text-on-surface-variant/70 mt-1">Ingested execution runs</p>
        </div>

        <div className="bg-surface-container/30 glass-panel rounded-xl p-4 border border-outline-variant/10">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Processed Files</span>
            <CheckCircle className="h-4 w-4 text-secondary" />
          </div>
          <div className="text-2xl font-bold font-mono text-secondary">{stats.successfulFiles}</div>
          <p className="text-[10px] text-on-surface-variant/70 mt-1">Invoices generated</p>
        </div>

        <div className="bg-surface-container/30 glass-panel rounded-xl p-4 border border-outline-variant/10">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Failed / Incomplete</span>
            <AlertTriangle className="h-4 w-4 text-error" />
          </div>
          <div className="text-2xl font-bold font-mono text-error">{stats.failedFiles}</div>
          <p className="text-[10px] text-on-surface-variant/70 mt-1">Requires attention</p>
        </div>

        <div className="bg-surface-container/30 glass-panel rounded-xl p-4 border border-outline-variant/10">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Success Rate</span>
            <Percent className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-on-surface">{stats.successRate}%</div>
          <p className="text-[10px] text-on-surface-variant/70 mt-1">Run reliability</p>
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
              <div className="space-y-4">
                {/* Hidden native browser file/folder pickers */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xlsm"
                  style={{ display: 'none' }}
                  onChange={handleBrowserFileChange}
                />
                <input
                  type="file"
                  ref={folderInputRef}
                  webkitdirectory=""
                  directory=""
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleBrowserFolderChange}
                />

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-on-surface-variant/75 uppercase tracking-wider block">Sheet Type</label>
                  <select
                    value={sheetType}
                    onChange={(e) => setSheetType && setSheetType(e.target.value)}
                    className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="example_1">Example 1 (Default)</option>
                    <option value="example_2">Example 2 (with QR Code)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleBrowserFolderClick}
                    disabled={folderLoading || sheetLoading || scanLoading}
                    className="w-full bg-primary text-on-primary hover:bg-primary/90 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/10 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {folderLoading ? (
                      <span>Loading...</span>
                    ) : (
                      <>
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>Browse Folder</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleBrowserFileClick}
                    disabled={folderLoading || sheetLoading || scanLoading}
                    className="w-full bg-surface-lowest text-on-surface hover:bg-surface-container-high py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-outline-variant/30 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {sheetLoading ? (
                      <span>Loading...</span>
                    ) : (
                      <>
                        <FolderOpen className="h-3.5 w-3.5 text-primary" />
                        <span>Browse Sheet</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 border-t border-outline-variant/20 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                    <span>Or Direct Folder / File Path</span>
                    <button
                      type="button"
                      onClick={() => handleScanManualPath("test_data")}
                      className="text-[10px] text-primary hover:underline font-bold lowercase normal-case cursor-pointer"
                    >
                      ⚡ load test_data
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualPath}
                      onChange={(e) => setManualPath(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleScanManualPath()}
                      placeholder="e.g. test_data or D:\path\to\portfolios"
                      className="flex-1 bg-surface-lowest border border-[#232d3f]/60 rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary font-mono"
                    />
                    <button
                      onClick={() => handleScanManualPath()}
                      disabled={scanLoading || !manualPath.trim()}
                      className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      {scanLoading ? 'Scanning...' : 'Scan'}
                    </button>
                  </div>
                </div>
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
          
          <div className="overflow-auto max-h-[400px] scrollbar-thin flex-1">
            {recentBatches.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-surface-lowest/95 backdrop-blur-md">
                  <tr className="border-b border-[#232d3f]/40">
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
