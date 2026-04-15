import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createCPU, resetCPU, executeInstruction, syncSFRsToRAM, syncRAMToSFRs, getRn, type CPUState } from '@/lib/cpu8051';
import { assemble, type AssemblerResult, type AssemblerError } from '@/lib/assembler8051';
import { savedPrograms, NEW_PROGRAM_TEMPLATE } from '@/lib/programs8051';
import { Play, RotateCcw, StepForward, Bug, Square, Download, FilePlus, ChevronDown, Search, Cpu, Terminal, Lightbulb, MemoryStick, Sun, Moon, Github, X as XIcon, Smartphone } from 'lucide-react';

const hex = (v: number, digits = 2) => v.toString(16).toUpperCase().padStart(digits, '0');

// Landing Page
function LandingPage({ onStart, lightMode, setLightMode }: { onStart: () => void; lightMode: boolean; setLightMode: (v: boolean) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4"
      style={{ backgroundColor: 'hsl(var(--background))' }}>
      <div className="text-center max-w-lg space-y-6">
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'hsl(var(--primary) / 0.15)' }}>
            <Cpu className="w-10 h-10" style={{ color: 'hsl(var(--primary))' }} />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>
          8051 <span style={{ color: 'hsl(var(--primary))' }}>Simulator</span>
        </h1>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: "'Inter', sans-serif" }}>
          A professional-grade 8051 Microcontroller IDE & Simulator with cycle-accurate emulation, live memory view, and port monitoring.
        </p>
        <button
          onClick={onStart}
          className="px-8 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105"
          style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
          🚀 Start Debugging
        </button>
      </div>

      <footer className="absolute bottom-4 flex flex-col items-center gap-2">
        <a href="https://github.com/abhishek132006" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:opacity-80"
          style={{ backgroundColor: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground))' }}>
          <Github className="w-4 h-4" /> GitHub
        </a>
        <span className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Built by <span style={{ color: 'hsl(var(--primary))', fontWeight: 600 }}>Abhishek K B</span>
        </span>
      </footer>
    </div>
  );
}

// Install banner with install button
function InstallBanner({ onClose }: { onClose: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as any);
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') onClose();
      setDeferredPrompt(null);
    } else {
      // Fallback: guide user
      alert('To install: Open browser menu → "Add to Home Screen" or "Install App"');
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs gap-2"
      style={{ backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--foreground))' }}>
      <span className="flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
        <span>Install this app on your device for the best experience!</span>
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={handleInstall}
          className="px-3 py-1 rounded text-[11px] font-bold transition-colors"
          style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
          Install
        </button>
        <button onClick={onClose} className="p-0.5 rounded hover:opacity-70">
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function IDE8051() {
  const [showLanding, setShowLanding] = useState(true);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [cpu, setCpu] = useState<CPUState>(() => createCPU());
  const [source, setSource] = useState(savedPrograms[0].code);
  const [assembled, setAssembled] = useState(false);
  const [errors, setErrors] = useState<AssemblerError[]>([]);
  const [asmResult, setAsmResult] = useState<AssemblerResult | null>(null);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [memSearch, setMemSearch] = useState('');
  const [memType, setMemType] = useState<'internal' | 'external'>('internal');
  const [editingCell, setEditingCell] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showPrograms, setShowPrograms] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [lightMode, setLightMode] = useState(true);
  const runRef = useRef(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'registers' | 'memory' | 'ports'>('editor');

  const updateCPU = useCallback(() => {
    setCpu(prev => ({ ...prev }));
  }, []);

  const handleDebug = useCallback(() => {
    const result = assemble(source);
    setAsmResult(result);
    setErrors(result.errors);
    
    if (result.success) {
      const newCpu = createCPU();
      newCpu.code = result.code;
      setCpu(newCpu);
      setAssembled(true);
      setCurrentLine(result.addrToLine.get(0) || null);
      setStatusMsg(`Build successful. ${result.symbols.size} symbols defined.`);
    } else {
      setAssembled(false);
      setCurrentLine(null);
      setStatusMsg(`Build failed: ${result.errors.length} error(s)`);
    }
  }, [source]);

  const handleStep = useCallback(() => {
    if (!assembled || !asmResult) return;
    const newCpu = { ...cpu, iram: new Uint8Array(cpu.iram), xram: new Uint8Array(cpu.xram), code: new Uint8Array(cpu.code) };
    
    const op = newCpu.code[newCpu.PC];
    if (op === 0x80) {
      const rel = newCpu.code[(newCpu.PC + 1) & 0xFFFF];
      if (rel === 0xFE) {
        newCpu.halted = true;
        setStatusMsg('Program halted (SJMP $)');
        setCpu(newCpu);
        setCurrentLine(asmResult.addrToLine.get(newCpu.PC) || null);
        return;
      }
    }
    
    executeInstruction(newCpu);
    setCpu(newCpu);
    setCurrentLine(asmResult.addrToLine.get(newCpu.PC) || null);
    setStatusMsg(`PC: ${hex(newCpu.PC, 4)}h | Cycles: ${newCpu.cycles}`);
  }, [cpu, assembled, asmResult]);

  const handleRun = useCallback(() => {
    if (!assembled || !asmResult) return;
    if (running) {
      runRef.current = false;
      setRunning(false);
      setStatusMsg('Stopped');
      return;
    }

    runRef.current = true;
    setRunning(true);
    setStatusMsg('Running...');

    const cpuCopy = { ...cpu, iram: new Uint8Array(cpu.iram), xram: new Uint8Array(cpu.xram), code: new Uint8Array(cpu.code) };

    const runBatch = () => {
      if (!runRef.current) {
        setCpu(cpuCopy);
        setCurrentLine(asmResult.addrToLine.get(cpuCopy.PC) || null);
        return;
      }

      for (let i = 0; i < 1000; i++) {
        const op = cpuCopy.code[cpuCopy.PC];
        if (op === 0x80 && cpuCopy.code[(cpuCopy.PC + 1) & 0xFFFF] === 0xFE) {
          cpuCopy.halted = true;
          runRef.current = false;
          setRunning(false);
          setCpu({ ...cpuCopy, iram: new Uint8Array(cpuCopy.iram), xram: new Uint8Array(cpuCopy.xram), code: new Uint8Array(cpuCopy.code) });
          setCurrentLine(asmResult.addrToLine.get(cpuCopy.PC) || null);
          setStatusMsg(`Halted at PC=${hex(cpuCopy.PC, 4)}h, Cycles: ${cpuCopy.cycles}`);
          return;
        }
        if (cpuCopy.halted) {
          runRef.current = false;
          setRunning(false);
          setCpu({ ...cpuCopy, iram: new Uint8Array(cpuCopy.iram), xram: new Uint8Array(cpuCopy.xram), code: new Uint8Array(cpuCopy.code) });
          setCurrentLine(asmResult.addrToLine.get(cpuCopy.PC) || null);
          setStatusMsg(`Halted at PC=${hex(cpuCopy.PC, 4)}h, Cycles: ${cpuCopy.cycles}`);
          return;
        }
        executeInstruction(cpuCopy);
      }

      setCpu({ ...cpuCopy, iram: new Uint8Array(cpuCopy.iram), xram: new Uint8Array(cpuCopy.xram), code: new Uint8Array(cpuCopy.code) });
      setCurrentLine(asmResult.addrToLine.get(cpuCopy.PC) || null);
      requestAnimationFrame(runBatch);
    };

    requestAnimationFrame(runBatch);
  }, [cpu, assembled, asmResult, running]);

  const handleReset = useCallback(() => {
    runRef.current = false;
    setRunning(false);
    const newCpu = createCPU();
    if (asmResult?.success) {
      newCpu.code = asmResult.code;
      setCurrentLine(asmResult.addrToLine.get(0) || null);
    }
    setCpu(newCpu);
    setStatusMsg('Reset');
  }, [asmResult]);

  const handleNew = useCallback(() => {
    runRef.current = false;
    setRunning(false);
    setSource(NEW_PROGRAM_TEMPLATE);
    setAssembled(false);
    setErrors([]);
    setAsmResult(null);
    setCurrentLine(null);
    setCpu(createCPU());
    setStatusMsg('New program');
  }, []);

  const handleSave = useCallback(() => {
    const blob = new Blob([source], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program_8051.txt';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Program saved as .txt');
  }, [source]);

  const handleLoadProgram = useCallback((code: string) => {
    setSource(code);
    setAssembled(false);
    setErrors([]);
    setAsmResult(null);
    setCurrentLine(null);
    runRef.current = false;
    setRunning(false);
    setCpu(createCPU());
    setShowPrograms(false);
    setStatusMsg('Program loaded');
  }, []);

  const handleMemEdit = useCallback((addr: number, val: string) => {
    let num: number;
    const trimmed = val.trim().toUpperCase();
    if (trimmed.endsWith('B')) {
      num = parseInt(trimmed.slice(0, -1), 2);
    } else if (trimmed.endsWith('D')) {
      num = parseInt(trimmed.slice(0, -1), 10);
    } else if (/^[0-9A-F]+$/.test(trimmed)) {
      num = parseInt(trimmed, 16);
    } else {
      num = parseInt(trimmed, 10);
    }

    if (isNaN(num)) return;
    num &= 0xFF;

    setCpu(prev => {
      const newCpu = { ...prev, iram: new Uint8Array(prev.iram), xram: new Uint8Array(prev.xram), code: new Uint8Array(prev.code) };
      if (memType === 'internal') {
        newCpu.iram[addr] = num;
        syncRAMToSFRs(newCpu);
      } else {
        newCpu.xram[addr] = num;
      }
      return newCpu;
    });
    setEditingCell(null);
  }, [memType]);

  const searchAddr = useMemo(() => {
    if (!memSearch.trim()) return null;
    const s = memSearch.trim().toUpperCase();
    let v: number;
    if (s.endsWith('H')) v = parseInt(s.slice(0, -1), 16);
    else if (s.startsWith('0X')) v = parseInt(s, 16);
    else v = parseInt(s, 16);
    return isNaN(v) ? null : v;
  }, [memSearch]);

  const sourceLines = source.split('\n');
  const categories = [...new Set(savedPrograms.map(p => p.category))];

  const themeVars = lightMode ? {
    '--background': '30 100% 97%',
    '--foreground': '20 14% 15%',
    '--card': '30 60% 95%',
    '--card-foreground': '20 14% 15%',
    '--popover': '30 60% 95%',
    '--popover-foreground': '20 14% 15%',
    '--primary': '24 80% 50%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '30 30% 90%',
    '--secondary-foreground': '20 14% 15%',
    '--muted': '30 30% 90%',
    '--muted-foreground': '20 10% 45%',
    '--accent': '142 60% 40%',
    '--accent-foreground': '0 0% 100%',
    '--destructive': '0 84% 50%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '30 20% 82%',
    '--input': '30 20% 82%',
    '--ring': '24 80% 50%',
    '--surface-0': '30 100% 97%',
    '--surface-1': '30 50% 94%',
    '--surface-2': '30 40% 91%',
    '--surface-3': '30 30% 86%',
    '--led-on': '142 60% 40%',
    '--led-off': '30 20% 85%',
    '--editor-bg': '0 0% 100%',
    '--editor-line': '30 30% 96%',
    '--editor-highlight': '24 80% 50% / 0.12',
    '--editor-cursor': '24 80% 50%',
    '--syntax-keyword': '220 80% 45%',
    '--syntax-register': '142 60% 35%',
    '--syntax-number': '24 90% 45%',
    '--syntax-comment': '20 10% 55%',
    '--syntax-label': '340 70% 45%',
    '--syntax-directive': '280 55% 50%',
    '--syntax-string': '24 90% 45%',
    '--success': '142 60% 40%',
    '--warning': '38 92% 50%',
  } as React.CSSProperties : undefined;

  if (showLanding) {
    return (
      <div style={themeVars}>
        <LandingPage onStart={() => setShowLanding(false)} lightMode={lightMode} setLightMode={setLightMode} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${lightMode ? 'light-theme' : ''}`}
      style={themeVars}
    >
      {showInstallBanner && <InstallBanner onClose={() => setShowInstallBanner(false)} />}

      {/* Header */}
      <header className="flex items-center justify-between px-2 sm:px-3 py-2 border-b border-border shrink-0"
        style={{ backgroundColor: 'hsl(var(--surface-1))' }}>
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
          <h1 className="text-sm font-bold tracking-wide hidden sm:block" style={{ color: 'hsl(var(--foreground))' }}>
            8051 <span style={{ color: 'hsl(var(--primary))' }}>Simulator</span>
          </h1>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={handleNew} className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded transition-colors"
            style={{ backgroundColor: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground))' }}
            title="New Program">
            <FilePlus className="w-3.5 h-3.5" /> New
          </button>
          <button onClick={handleSave} className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded transition-colors"
            style={{ backgroundColor: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground))' }}
            title="Save as .txt">
            <Download className="w-3.5 h-3.5" /> Save
          </button>
          <div className="w-px h-5" style={{ backgroundColor: 'hsl(var(--border))' }} />
          <button onClick={handleDebug} className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded font-semibold transition-colors"
            style={{ backgroundColor: 'hsl(var(--primary) / 0.2)', color: 'hsl(var(--primary))' }}
            title="Build & Debug">
            <Bug className="w-3.5 h-3.5" /> Debug
          </button>
          <button onClick={handleStep} disabled={!assembled || running || cpu.halted}
            className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground))' }}
            title="Step Into">
            <StepForward className="w-3.5 h-3.5" /> Step
          </button>
          <button onClick={handleRun} disabled={!assembled || cpu.halted}
            className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: running ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--success) / 0.2)',
              color: running ? 'hsl(var(--destructive))' : 'hsl(var(--success))'
            }}
            title={running ? "Stop" : "Run"}>
            {running ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {running ? 'Stop' : 'Run'}
          </button>
          <button onClick={handleReset} className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded transition-colors"
            style={{ backgroundColor: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground))' }}
            title="Reset">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <button onClick={() => setLightMode(!lightMode)}
            className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded transition-colors"
            style={{ backgroundColor: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground))' }}
            title={lightMode ? 'Dark Mode' : 'Light Mode'}>
            {lightMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* Saved Programs Dropdown */}
          <div className="relative ml-1">
            <button onClick={() => setShowPrograms(!showPrograms)}
              className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded transition-colors"
              style={{ backgroundColor: 'hsl(var(--surface-2))', color: 'hsl(var(--foreground))' }}>
              <span className="hidden md:inline">Saved Programs</span>
              <span className="md:hidden">Programs</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showPrograms && (
              <div className="absolute right-0 top-full mt-1 w-64 border rounded-lg shadow-xl z-50 max-h-80 overflow-auto scrollbar-thin"
                style={{ backgroundColor: 'hsl(var(--surface-2))', borderColor: 'hsl(var(--border))' }}>
                {categories.map(cat => (
                  <div key={cat}>
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: 'hsl(var(--surface-1))', color: 'hsl(var(--muted-foreground))' }}>{cat}</div>
                    {savedPrograms.filter(p => p.category === cat).map(p => (
                      <button key={p.name} onClick={() => handleLoadProgram(p.code)}
                        className="w-full text-left px-3 py-2 text-xs transition-colors hover:opacity-80"
                        style={{ color: 'hsl(var(--foreground))' }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="flex lg:hidden border-b shrink-0"
        style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--surface-1))' }}>
        {(['editor', 'registers', 'memory', 'ports'] as const).map(tab => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors`}
            style={{
              color: mobileTab === tab ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              borderBottom: mobileTab === tab ? '2px solid hsl(var(--primary))' : '2px solid transparent'
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Registers */}
        <aside className={`${mobileTab === 'registers' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-56 xl:w-64 border-r overflow-auto scrollbar-thin shrink-0`}
          style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--surface-1))' }}>
          <RegistersPanel cpu={cpu} />
        </aside>

        {/* Center: Editor - SINGLE TEXTAREA, no overlay */}
        <main className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-w-0 overflow-hidden`}>
          <div className="flex-1 overflow-hidden flex" style={{ backgroundColor: 'hsl(var(--editor-bg))' }}>
            {/* Line numbers */}
            <div className="select-none text-right pr-2 pl-2 pt-2 text-[11px] leading-[20px] font-mono shrink-0 overflow-hidden"
              style={{ minWidth: '2.5rem', color: 'hsl(var(--muted-foreground))' }}
              id="line-numbers">
              {sourceLines.map((_, i) => (
                <div key={i} style={currentLine === i + 1 ? { color: 'hsl(var(--primary))', fontWeight: 'bold' } : undefined}>
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Plain editable textarea */}
            <textarea
              value={source}
              onChange={e => {
                setSource(e.target.value);
                setAssembled(false);
              }}
              onScroll={e => {
                const lineNums = document.getElementById('line-numbers');
                if (lineNums) lineNums.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
              }}
              className="flex-1 w-full h-full pt-2 px-1 pr-4 font-mono text-[11px] leading-[20px] resize-none outline-none"
              style={{
                backgroundColor: 'transparent',
                color: 'hsl(var(--foreground))',
                caretColor: 'hsl(var(--editor-cursor))',
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
            />
          </div>

          {/* Error/Output Panel */}
          <div className="h-28 lg:h-32 border-t overflow-auto scrollbar-thin shrink-0"
            style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--surface-1))' }}>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b"
              style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--surface-2))' }}>
              <Terminal className="w-3.5 h-3.5" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'hsl(var(--muted-foreground))' }}>Output & Errors</span>
            </div>
            <div className="p-2 font-mono text-[11px]">
              {errors.length > 0 ? (
                errors.map((e, i) => (
                  <div key={i} style={{ color: 'hsl(var(--destructive))' }}>
                    <span style={{ opacity: 0.7 }}>Line {e.line}:</span> {e.message}
                  </div>
                ))
              ) : (
                <div style={{ color: 'hsl(var(--muted-foreground))' }}>{statusMsg}</div>
              )}
              {cpu.serialOutput && (
                <div className="mt-1 pt-1" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                  <span className="text-[10px]" style={{ color: 'hsl(var(--primary))' }}>Serial Output: </span>
                  <span style={{ color: 'hsl(var(--success))' }}>{cpu.serialOutput}</span>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right: Memory + Ports */}
        <aside className={`${mobileTab === 'memory' || mobileTab === 'ports' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-72 xl:w-80 border-l overflow-hidden shrink-0`}
          style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--surface-1))' }}>
          <div className={`${mobileTab === 'memory' ? 'flex' : mobileTab === 'ports' ? 'hidden lg:flex' : 'hidden lg:flex'} flex-col flex-1 overflow-hidden`}>
            <MemoryPanel
              cpu={cpu}
              memType={memType}
              setMemType={setMemType}
              memSearch={memSearch}
              setMemSearch={setMemSearch}
              searchAddr={searchAddr}
              editingCell={editingCell}
              setEditingCell={setEditingCell}
              editValue={editValue}
              setEditValue={setEditValue}
              handleMemEdit={handleMemEdit}
            />
          </div>
          <div className={`${mobileTab === 'ports' ? 'flex' : mobileTab === 'memory' ? 'hidden lg:flex' : 'hidden lg:flex'} flex-col border-t shrink-0`}
            style={{ borderColor: 'hsl(var(--border))' }}>
            <PortsPanel cpu={cpu} />
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-3 py-1 border-t text-[10px] shrink-0"
        style={{ backgroundColor: 'hsl(var(--surface-2))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
        <span>PC: {hex(cpu.PC, 4)}h | Cycles: {cpu.cycles}</span>
        <span className="flex items-center gap-2">
          {assembled ? (cpu.halted ? '● Halted' : running ? '● Running' : '● Ready') : '○ Not built'}
          <span className="hidden sm:inline">|</span>
          <span className="hidden sm:inline">Built by <span style={{ color: 'hsl(var(--primary))', fontWeight: 600 }}>Abhishek K B</span></span>
          <a href="https://github.com/abhishek132006" target="_blank" rel="noopener noreferrer"
            className="hover:opacity-70 transition-opacity">
            <Github className="w-3 h-3" />
          </a>
        </span>
      </footer>

      {showPrograms && <div className="fixed inset-0 z-40" onClick={() => setShowPrograms(false)} />}
    </div>
  );
}

function RegistersPanel({ cpu }: { cpu: CPUState }) {
  const bank = ((cpu.RS1 ? 1 : 0) << 1) | (cpu.RS0 ? 1 : 0);

  return (
    <div className="p-2 space-y-3 text-[11px]">
      <section>
        <div className="flex items-center gap-1.5 mb-2">
          <Cpu className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>CPU Registers</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[
            ['A', hex(cpu.A)],
            ['B', hex(cpu.B)],
            ['SP', hex(cpu.SP)],
            ['PC', hex(cpu.PC, 4)],
            ['DPTR', hex(cpu.DPTR, 4)],
          ].map(([name, val]) => (
            <div key={name} className="flex items-center justify-between rounded px-2 py-1"
              style={{ backgroundColor: 'hsl(var(--surface-2))' }}>
              <span style={{ color: 'hsl(var(--muted-foreground))' }} className="font-medium">{name}</span>
              <span style={{ color: 'hsl(var(--primary))' }} className="font-mono font-bold">{val}h</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
          R0-R7 <span style={{ color: 'hsl(var(--primary))' }}>(Bank {bank})</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[0,1,2,3,4,5,6,7].map(n => (
            <div key={n} className="flex items-center justify-between rounded px-2 py-1"
              style={{ backgroundColor: 'hsl(var(--surface-2))' }}>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>R{n}</span>
              <span style={{ color: 'hsl(var(--primary))' }} className="font-mono font-bold">{hex(getRn(cpu, n))}h</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
          PSW <span style={{ color: 'hsl(var(--primary))' }}>{hex(cpu.iram[0xD0])}h</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[
            ['CY', cpu.CY], ['AC', cpu.AC], ['F0', cpu.F0], ['RS1', cpu.RS1],
            ['RS0', cpu.RS0], ['OV', cpu.OV], ['-', false], ['P', cpu.P],
          ].map(([name, val], i) => (
            <div key={i} className="text-center rounded py-1 text-[10px] font-bold"
              style={{
                backgroundColor: val ? 'hsl(var(--success) / 0.2)' : 'hsl(var(--surface-2))',
                color: val ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))'
              }}>
              {name as string}
              <div className="text-[9px] font-mono">{val ? '1' : '0'}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>SFRs</div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          {[
            ['P0', hex(cpu.P0)], ['P1', hex(cpu.P1)], ['P2', hex(cpu.P2)], ['P3', hex(cpu.P3)],
            ['TMOD', hex(cpu.TMOD)], ['TCON', hex(cpu.TCON)],
            ['SCON', hex(cpu.SCON)], ['SBUF', hex(cpu.SBUF)],
            ['IE', hex(cpu.IE)], ['IP', hex(cpu.IP)],
          ].map(([name, val]) => (
            <div key={name} className="flex items-center justify-between rounded px-2 py-0.5"
              style={{ backgroundColor: 'hsl(var(--surface-2))' }}>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>{name}</span>
              <span style={{ color: 'hsl(var(--foreground))' }} className="font-mono">{val}h</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MemoryPanel({
  cpu, memType, setMemType, memSearch, setMemSearch, searchAddr,
  editingCell, setEditingCell, editValue, setEditValue, handleMemEdit
}: {
  cpu: CPUState;
  memType: 'internal' | 'external';
  setMemType: (t: 'internal' | 'external') => void;
  memSearch: string;
  setMemSearch: (s: string) => void;
  searchAddr: number | null;
  editingCell: number | null;
  setEditingCell: (c: number | null) => void;
  editValue: string;
  setEditValue: (v: string) => void;
  handleMemEdit: (addr: number, val: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const maxAddr = memType === 'internal' ? 0xFF : 0xFFFF;
  const cols = 16;
  const rows = Math.ceil((maxAddr + 1) / cols);

  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 22;
  const visibleRows = 20;

  useEffect(() => {
    if (searchAddr !== null && scrollRef.current) {
      const row = Math.floor(searchAddr / cols);
      scrollRef.current.scrollTop = row * rowHeight;
    }
  }, [searchAddr, cols]);

  const startRow = memType === 'external' ? Math.floor(scrollTop / rowHeight) : 0;
  const endRow = memType === 'external' ? Math.min(startRow + visibleRows + 2, rows) : rows;

  const mem = memType === 'internal' ? cpu.iram : cpu.xram;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0"
        style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--surface-2))' }}>
        <MemoryStick className="w-3.5 h-3.5" style={{ color: 'hsl(var(--muted-foreground))' }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Memory</span>
        <div className="flex-1" />
        <button onClick={() => setMemType('internal')}
          className="px-2 py-0.5 text-[10px] rounded"
          style={{
            backgroundColor: memType === 'internal' ? 'hsl(var(--primary))' : 'hsl(var(--surface-3))',
            color: memType === 'internal' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))'
          }}>
          Internal
        </button>
        <button onClick={() => setMemType('external')}
          className="px-2 py-0.5 text-[10px] rounded"
          style={{
            backgroundColor: memType === 'external' ? 'hsl(var(--primary))' : 'hsl(var(--surface-3))',
            color: memType === 'external' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))'
          }}>
          External
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 py-1 border-b shrink-0"
        style={{ borderColor: 'hsl(var(--border))' }}>
        <Search className="w-3 h-3" style={{ color: 'hsl(var(--muted-foreground))' }} />
        <input
          type="text"
          value={memSearch}
          onChange={e => setMemSearch(e.target.value)}
          placeholder={`Address (e.g. ${memType === 'internal' ? '30' : '0100'})...`}
          className="flex-1 bg-transparent text-[11px] outline-none"
          style={{ color: 'hsl(var(--foreground))' }}
        />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto scrollbar-thin font-mono text-[10px]"
        onScroll={e => memType === 'external' && setScrollTop((e.target as HTMLDivElement).scrollTop)}
        style={memType === 'external' ? { position: 'relative' } : undefined}
      >
        {memType === 'external' && (
          <div style={{ height: rows * rowHeight, position: 'relative' }}>
            <div style={{ position: 'absolute', top: startRow * rowHeight, left: 0, right: 0 }}>
              {renderRows(startRow, endRow)}
            </div>
          </div>
        )}
        {memType === 'internal' && (
          <div>{renderRows(0, rows)}</div>
        )}
      </div>
    </div>
  );

  function renderRows(start: number, end: number) {
    const result = [];
    for (let row = start; row < end; row++) {
      const baseAddr = row * cols;
      const addrDigits = memType === 'internal' ? 2 : 4;
      const isSearchRow = searchAddr !== null && Math.floor(searchAddr / cols) === row;

      result.push(
        <div key={row} className="flex items-center"
          style={{
            height: rowHeight,
            backgroundColor: isSearchRow ? 'hsl(var(--primary) / 0.1)' : undefined
          }}>
          <div className="w-10 lg:w-12 text-right pr-1.5 shrink-0 font-semibold"
            style={{ color: 'hsl(var(--muted-foreground))' }}>
            {hex(baseAddr, addrDigits)}
          </div>
          {Array.from({ length: cols }, (_, c) => {
            const addr = baseAddr + c;
            if (addr > maxAddr) return <div key={c} className="w-5 shrink-0" />;
            const val = mem[addr];
            const isSearched = searchAddr === addr;
            const isEditing = editingCell === addr;
            const isSFR = memType === 'internal' && addr >= 0x80;

            if (isEditing) {
              return (
                <input key={c} autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => handleMemEdit(addr, editValue)}
                  onKeyDown={e => { if (e.key === 'Enter') handleMemEdit(addr, editValue); if (e.key === 'Escape') setEditingCell(null); }}
                  className="w-5 text-center outline-none text-[10px] rounded"
                  style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                />
              );
            }

            return (
              <div key={c}
                onClick={() => { setEditingCell(addr); setEditValue(hex(val)); }}
                className="w-5 text-center cursor-pointer rounded-sm transition-colors"
                style={{
                  color: isSearched ? 'hsl(var(--warning))' :
                    val !== 0 ? (isSFR ? 'hsl(var(--syntax-register))' : 'hsl(var(--foreground))') :
                    'hsl(var(--muted-foreground) / 0.4)',
                  fontWeight: isSearched ? 'bold' : undefined,
                  backgroundColor: isSearched ? 'hsl(var(--warning) / 0.3)' : undefined
                }}
                title={`${hex(addr, addrDigits)}h = ${val} (${hex(val)}h)`}>
                {hex(val)}
              </div>
            );
          })}
        </div>
      );
    }
    return result;
  }
}

function PortsPanel({ cpu }: { cpu: CPUState }) {
  const ports = [
    { name: 'P0', val: cpu.P0, addr: '80h' },
    { name: 'P1', val: cpu.P1, addr: '90h' },
    { name: 'P2', val: cpu.P2, addr: 'A0h' },
    { name: 'P3', val: cpu.P3, addr: 'B0h' },
  ];

  return (
    <div className="p-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-3.5 h-3.5" style={{ color: 'hsl(var(--warning))' }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Port Monitor</span>
      </div>
      <div className="space-y-2">
        {ports.map(port => (
          <div key={port.name} className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--surface-2))' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold" style={{ color: 'hsl(var(--foreground))' }}>
                {port.name} <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 'normal' }}>({port.addr})</span>
              </span>
              <span className="text-[10px] font-mono" style={{ color: 'hsl(var(--primary))' }}>{hex(port.val)}h</span>
            </div>
            <div className="flex gap-1 justify-center">
              {Array.from({ length: 8 }, (_, i) => {
                const bitOn = !!(port.val & (1 << (7 - i)));
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <div className="w-4 h-4 rounded-full border transition-colors"
                      style={{
                        backgroundColor: bitOn ? 'hsl(var(--led-on))' : 'hsl(var(--led-off))',
                        borderColor: bitOn ? 'hsl(var(--led-on))' : 'hsl(var(--border))',
                        boxShadow: bitOn ? '0 0 6px hsl(var(--led-on))' : 'none'
                      }}
                    />
                    <span className="text-[8px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{7 - i}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {cpu.serialOutput && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Terminal className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Serial (SBUF)</span>
          </div>
          <div className="rounded p-2 font-mono text-[11px] min-h-[2rem]"
            style={{ backgroundColor: 'hsl(var(--surface-2))', color: 'hsl(var(--success))' }}>
            {cpu.serialOutput}
          </div>
        </div>
      )}
    </div>
  );
}
