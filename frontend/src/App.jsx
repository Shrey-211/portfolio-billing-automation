import { useState, useEffect } from 'react';
import Home from './components/Home';
import Workbench from './components/Workbench';
import Processing from './components/Processing';
import Results from './components/Results';
import Settings from './components/Settings';
import { 
  Layers, 
  FileSpreadsheet, 
  Cpu, 
  Send, 
  Settings as SettingsIcon,
  Activity,
  User,
  Sun,
  Moon,
  Table,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import MasterSheet from './components/MasterSheet';


function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [folderPath, setFolderPath] = useState('');
  const [queue, setQueue] = useState([]);
  const [batchId, setBatchId] = useState(null);
  const [importMode, setImportMode] = useState('folder'); // 'folder' or 'sheet'
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };


  // Theme support
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Tab config
  const navItems = [
    { id: 'home', label: 'Dashboard', icon: Layers },
    { id: 'workbench', label: 'File Queue', icon: FileSpreadsheet, badge: queue.length > 0 ? queue.length : null },
    { id: 'processing', label: 'Billing Engine', icon: Cpu },
    { id: 'results', label: 'Results & Delivery', icon: Send },
    { id: 'master', label: 'Master Sheet', icon: Table },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface font-sans relative selection:bg-primary selection:text-on-primary">
      {/* Ambient Background Glows */}
      <div className="ambient-glow"></div>
      <div className="ambient-glow-secondary"></div>
      
      {/* SideNavBar - Styled according to Angel One Glassmorphism Guidelines */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-72'} bg-surface-lowest/80 backdrop-blur-xl border-r border-outline-variant/20 flex flex-col justify-between flex-shrink-0 z-50 transition-all duration-300 ease-in-out`}>
        <div className="flex flex-col flex-1">
          {/* Logo Header */}
          <div className={`h-20 ${isCollapsed ? 'px-2 flex-col justify-center gap-2 h-auto py-4' : 'px-6 flex-row justify-between'} flex items-center pt-4`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex-shrink-0 flex items-center justify-center border border-primary/30">
                <Activity className="h-5 w-5 text-primary animate-pulse" />
              </div>
              {!isCollapsed && (
                <div className="animate-fade-in">
                  <span className="text-lg font-extrabold text-primary tracking-wide block">AlphaBilling</span>
                  <span className="block text-[10px] text-on-surface-variant uppercase tracking-widest opacity-70">Elite Portfolio Management</span>
                </div>
              )}
            </div>
            <button
              onClick={toggleSidebar}
              className={`p-1.5 rounded-lg hover:bg-surface-container-high/60 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer border border-outline-variant/10 ${isCollapsed ? 'mt-2' : ''}`}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-3'} rounded-lg border-l-4 transition-all duration-200 active:scale-95 transition-transform ${
                    isActive 
                      ? 'bg-primary/10 text-primary font-bold border-primary' 
                      : 'text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container-high/30 border-transparent'
                  }`}
                  title={isCollapsed ? item.label : ""}
                >
                  <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <Icon className={`h-4.5 w-4.5 flex-shrink-0 transition-colors ${
                      isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'
                    }`} />
                    {!isCollapsed && <span className="text-sm font-semibold animate-fade-in">{item.label}</span>}
                  </span>
                  {!isCollapsed && item.badge && (
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-primary/20 text-primary' : 'bg-surface-container-low text-on-surface-variant'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {isCollapsed && item.badge && (
                    <span className="absolute top-1 right-2 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[8px] font-bold bg-primary text-on-primary border border-surface-lowest">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile block */}
        <div className={`p-4 border-t border-outline-variant/20 bg-surface-lowest/40 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center p-1 w-11 h-11' : 'gap-3 p-1.5 w-full'} rounded-lg bg-surface-container-low/40 border border-outline-variant/10 transition-all duration-200`}>
            <div className="h-9 w-9 rounded-full bg-surface-container border border-outline-variant flex flex-shrink-0 items-center justify-center text-primary">
              <User className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 animate-fade-in">
                <p className="text-xs font-semibold text-on-surface truncate">Advisor Console</p>
                <p className="text-[9px] text-on-surface-variant truncate font-mono uppercase tracking-wider opacity-60">Antigravity Wealth</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-transparent p-8 md:p-10 scrollbar-thin z-10 relative">
        {/* Fixed Theme Switcher Toggle */}
        <div className="fixed top-6 right-8 z-50">
          <button
            onClick={toggleTheme}
            type="button"
            className="p-2.5 rounded-lg glass-panel text-on-surface-variant hover:text-on-surface hover:border-primary/45 transition-all duration-200 cursor-pointer active:scale-95 shadow-lg flex items-center justify-center bg-surface-lowest/40"
            title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {isDark ? (
              <Sun className="h-4.5 w-4.5 text-amber-400 animate-spin-slow" />
            ) : (
              <Moon className="h-4.5 w-4.5 text-primary" />
            )}
          </button>
        </div>

        <div className="max-w-[1400px] mx-auto space-y-8">
          {activeTab === 'home' && (
            <Home 
              setTab={setActiveTab}
              setQueue={setQueue}
              setFolderPath={setFolderPath}
              folderPath={folderPath}
              queue={queue}
              setImportMode={setImportMode}
            />
          )}
          
          {activeTab === 'workbench' && (
            <Workbench 
              queue={queue}
              setQueue={setQueue}
              folderPath={folderPath}
              setTab={setActiveTab}
              importMode={importMode}
            />
          )}
          
          {activeTab === 'processing' && (
            <Processing 
              setTab={setActiveTab}
              setBatchId={setBatchId}
            />
          )}
          
          {activeTab === 'results' && (
            <Results 
              batchId={batchId}
              setBatchId={setBatchId}
            />
          )}

          {activeTab === 'master' && (
            <MasterSheet folderPath={folderPath} />
          )}
          
          {activeTab === 'settings' && (
            <Settings />
          )}
        </div>
      </main>

    </div>
  );
}

export default App;
