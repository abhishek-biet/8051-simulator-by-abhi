import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createCPU, resetCPU, executeInstruction, syncSFRsToRAM, syncRAMToSFRs, getRn, type CPUState } from '@/lib/cpu8051';
import { assemble, type AssemblerResult, type AssemblerError } from '@/lib/assembler8051';
import { savedPrograms } from '@/lib/programs8051';
import { Play, RotateCcw, StepForward, Bug, Square, Download, FilePlus, ChevronDown, Search, Cpu, Terminal, Lightbulb, MemoryStick, Settings2 } from 'lucide-react';

const hex = (v: number, digits = 2) => v.toString(16).toUpperCase().padStart(digits, '0');

// Syntax highlighting for 8051 assembly
function highlightLine(line: string): JSX.Element {
  const parts: JSX.Element[] = [];
  let remaining = line;
  let key = 0;

  // Comment
  const commentIdx = remaining.indexOf(';');
  let comment = '';
  if (commentIdx >= 0) {
    comment = remaining.substring(commentIdx);
    remaining = remaining.substring(0, commentIdx);
  }

  // Tokenize
  const tokens = remaining.split(/(\s+|,)/);
  let isFirstToken = true;

  for (const token of tokens) {
    if (!token) continue;
    const tu = token.toUpperCase().trim();

    if (/^\s+$/.test(token) || token === ',') {
      parts.push(<span key={key++}>{token}</span>);
      continue;
    }

    // Label
    if (tu.endsWith(':')) {
      parts.push(<span key={key++} className="text-syntax-label font-bold">{token}</span>);
      isFirstToken = false;
      continue;
    }

    // Directives
    if (['ORG', 'EQU', 'DB', 'DW', 'END'].includes(tu)) {
      parts.push(<span key={key++} className="text-syntax-directive">{token}</span>);
      isFirstToken = false;
      continue;
    }

    // Instructions
    const instructions = ['MOV', 'MOVX', 'MOVC', 'ADD', 'ADDC', 'SUBB', 'MUL', 'DIV',
      'ANL', 'ORL', 'XRL', 'CLR', 'SETB', 'CPL', 'INC', 'DEC', 'DA', 'SWAP',
      'RL', 'RLC', 'RR', 'RRC', 'PUSH', 'POP', 'XCH', 'XCHD',
      'LJMP', 'SJMP', 'AJMP', 'JMP', 'LCALL', 'ACALL', 'RET', 'RETI',
      'JZ', 'JNZ', 'JC', 'JNC', 'JB', 'JNB', 'JBC', 'DJNZ', 'CJNE',
      'NOP'];
    if (instructions.includes(tu)) {
      parts.push(<span key={key++} className="text-syntax-keyword font-semibold">{token}</span>);
      isFirstToken = false;
      continue;
    }

    // Registers
    const registers = ['A', 'B', 'ACC', 'SP', 'DPTR', 'DPL', 'DPH', 'PSW',
      'P0', 'P1', 'P2', 'P3', 'TMOD', 'TCON', 'TH0', 'TL0', 'TH1', 'TL1',
      'SCON', 'SBUF', 'IE', 'IP', 'PCON',
      'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
      '@R0', '@R1', '@A+DPTR', '@A+PC', '@DPTR', 'C',
      'CY', 'AC', 'F0', 'RS1', 'RS0', 'OV', 'P'];
    if (registers.includes(tu)) {
      parts.push(<span key={key++} className="text-syntax-register">{token}</span>);
      isFirstToken = false;
      continue;
    }

    // Numbers: #data, hex, etc
    if (/^#/.test(token) || /^[0-9]/.test(tu) || /^0[xX]/.test(token) || /H$/i.test(token)) {
      parts.push(<span key={key++} className="text-syntax-number">{token}</span>);
      isFirstToken = false;
      continue;
    }

    // Character literals
    if (/^'.'$/.test(token)) {
      parts.push(<span key={key++} className="text-syntax-string">{token}</span>);
      isFirstToken = false;
      continue;
    }

    // Label reference (if not first token and looks like identifier)
    if (!isFirstToken && /^\w+$/.test(token)) {
      parts.push(<span key={key++} className="text-syntax-label">{token}</span>);
      continue;
    }

    parts.push(<span key={key++} className="text-foreground">{token}</span>);
    isFirstToken = false;
  }

  if (comment) {
    parts.push(<span key={key++} className="text-syntax-comment italic">{comment}</span>);
  }

  return <>{parts}</>;
}

export default function IDE8051() {
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
  const runRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
      // Initialize data in internal RAM if needed
      for (let i = 0; i < 65536; i++) {
        if (result.code[i] !== 0) {
          // Code memory is separate from internal RAM
        }
      }
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
    
    // Check for SJMP $ (infinite loop / halt)
    const op = newCpu.code[newCpu.PC];
    if (op === 0x80) { // SJMP
      const rel = newCpu.code[(newCpu.PC + 1) & 0xFFFF];
      if (rel === 0xFE) { // SJMP $ (jump to self)
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
        // Check for SJMP $ halt
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
    setSource('; Write your 8051 Assembly program here\n    ORG 0000H\n\n    ; Your code here\n\n    SJMP $\n    END');
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
    a.download = 'program_8051.asm';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Program saved');
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
    // Auto-convert: if ends with B, treat as binary; if ends with D, decimal; else hex
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

  // Memory search
  const searchAddr = useMemo(() => {
    if (!memSearch.trim()) return null;
    const s = memSearch.trim().toUpperCase();
    let v: number;
    if (s.endsWith('H')) v = parseInt(s.slice(0, -1), 16);
    else if (s.startsWith('0X')) v = parseInt(s, 16);
    else v = parseInt(s, 16);
    return isNaN(v) ? null : v;
  }, [memSearch]);

  // Get port bits as array
  const getPortBits = (portVal: number): boolean[] => {
    return Array.from({ length: 8 }, (_, i) => !!(portVal & (1 << (7 - i))));
  };

  const sourceLines = source.split('\n');

  // Categories for programs dropdown
  const categories = [...new Set(savedPrograms.map(p => p.category))];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-surface-1 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          <h1 className="text-sm font-bold text-foreground tracking-wide">8051 <span className="text-primary">µVision</span> IDE</h1>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1">
          <button onClick={handleNew} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-surface-2 hover:bg-surface-3 text-foreground transition-colors" title="New Program">
            <FilePlus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New</span>
          </button>
          <button onClick={handleSave} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-surface-2 hover:bg-surface-3 text-foreground transition-colors" title="Save as .asm">
            <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Save</span>
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button onClick={handleDebug} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-primary/20 hover:bg-primary/30 text-primary font-semibold transition-colors" title="Build & Debug">
            <Bug className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Debug</span>
          </button>
          <button onClick={handleStep} disabled={!assembled || running || cpu.halted} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-surface-2 hover:bg-surface-3 text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Step Into">
            <StepForward className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Step</span>
          </button>
          <button onClick={handleRun} disabled={!assembled || cpu.halted} className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded font-semibold transition-colors ${running ? 'bg-destructive/20 text-destructive hover:bg-destructive/30' : 'bg-success/20 text-success hover:bg-success/30'} disabled:opacity-40 disabled:cursor-not-allowed`} title={running ? "Stop" : "Run"}>
            {running ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{running ? 'Stop' : 'Run'}</span>
          </button>
          <button onClick={handleReset} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-surface-2 hover:bg-surface-3 text-foreground transition-colors" title="Reset">
            <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Saved Programs Dropdown */}
          <div className="relative ml-1">
            <button onClick={() => setShowPrograms(!showPrograms)} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-surface-2 hover:bg-surface-3 text-foreground transition-colors">
              <Settings2 className="w-3.5 h-3.5" /> <span className="hidden md:inline">Saved Programs</span> <ChevronDown className="w-3 h-3" />
            </button>
            {showPrograms && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-surface-2 border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-auto scrollbar-thin">
                {categories.map(cat => (
                  <div key={cat}>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-surface-1">{cat}</div>
                    {savedPrograms.filter(p => p.category === cat).map(p => (
                      <button key={p.name} onClick={() => handleLoadProgram(p.code)} className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 text-foreground transition-colors">
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
      <div className="flex lg:hidden border-b border-border bg-surface-1 shrink-0">
        {(['editor', 'registers', 'memory', 'ports'] as const).map(tab => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${mobileTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Registers Panel */}
        <aside className={`${mobileTab === 'registers' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-56 xl:w-64 border-r border-border bg-surface-1 overflow-auto scrollbar-thin shrink-0`}>
          <RegistersPanel cpu={cpu} />
        </aside>

        {/* Center: Editor */}
        <main className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-w-0 overflow-hidden`}>
          {/* Code Editor */}
          <div className="flex-1 overflow-auto scrollbar-thin" style={{ backgroundColor: 'hsl(var(--editor-bg))' }}>
            <div className="flex min-h-full">
              {/* Line numbers */}
              <div className="select-none text-right pr-2 pl-2 pt-2 text-[11px] leading-5 text-muted-foreground font-mono shrink-0" style={{ minWidth: '2.5rem' }}>
                {sourceLines.map((_, i) => (
                  <div key={i} className={`${currentLine === i + 1 ? 'text-primary font-bold' : ''}`}>
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Editor area - syntax highlighted overlay + textarea */}
              <div className="relative flex-1 min-w-0">
                {/* Highlighted code (visual only) */}
                <div className="absolute inset-0 pt-2 pr-4 pointer-events-none font-mono text-[11px] leading-5 whitespace-pre overflow-hidden">
                  {sourceLines.map((line, i) => (
                    <div key={i}
                      className={`px-1 ${currentLine === i + 1 ? 'rounded' : ''}`}
                      style={currentLine === i + 1 ? { backgroundColor: 'hsl(var(--editor-highlight))' } : undefined}>
                      {highlightLine(line)}
                    </div>
                  ))}
                </div>
                {/* Actual textarea */}
                <textarea
                  ref={textareaRef}
                  value={source}
                  onChange={e => {
                    setSource(e.target.value);
                    setAssembled(false);
                  }}
                  className="absolute inset-0 w-full h-full pt-2 px-1 pr-4 font-mono text-[11px] leading-5 bg-transparent text-transparent caret-primary resize-none outline-none"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
            </div>
          </div>

          {/* Error/Output Panel */}
          <div className="h-28 lg:h-32 border-t border-border bg-surface-1 overflow-auto scrollbar-thin shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface-2">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Output & Errors</span>
            </div>
            <div className="p-2 font-mono text-[11px]">
              {errors.length > 0 ? (
                errors.map((e, i) => (
                  <div key={i} className="text-destructive">
                    <span className="text-destructive/70">Line {e.line}:</span> {e.message}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">{statusMsg}</div>
              )}
              {cpu.serialOutput && (
                <div className="mt-1 pt-1 border-t border-border">
                  <span className="text-primary text-[10px]">Serial Output: </span>
                  <span className="text-success">{cpu.serialOutput}</span>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right: Memory + Ports */}
        <aside className={`${mobileTab === 'memory' || mobileTab === 'ports' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-72 xl:w-80 border-l border-border bg-surface-1 overflow-hidden shrink-0`}>
          {/* Memory section - show on mobile 'memory' tab, always on desktop */}
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

          {/* Ports section - show on mobile 'ports' tab, always on desktop */}
          <div className={`${mobileTab === 'ports' ? 'flex' : mobileTab === 'memory' ? 'hidden lg:flex' : 'hidden lg:flex'} flex-col border-t border-border shrink-0`}>
            <PortsPanel cpu={cpu} />
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-3 py-1 bg-surface-2 border-t border-border text-[10px] text-muted-foreground shrink-0">
        <span>PC: {hex(cpu.PC, 4)}h | Cycles: {cpu.cycles}</span>
        <span>{assembled ? (cpu.halted ? '● Halted' : running ? '● Running' : '● Ready') : '○ Not built'}</span>
      </footer>

      {/* Click outside to close programs dropdown */}
      {showPrograms && <div className="fixed inset-0 z-40" onClick={() => setShowPrograms(false)} />}
    </div>
  );
}

function RegistersPanel({ cpu }: { cpu: CPUState }) {
  const bank = ((cpu.RS1 ? 1 : 0) << 1) | (cpu.RS0 ? 1 : 0);

  return (
    <div className="p-2 space-y-3 text-[11px]">
      {/* Main Registers */}
      <section>
        <div className="flex items-center gap-1.5 mb-2">
          <Cpu className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CPU Registers</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[
            ['A', hex(cpu.A)],
            ['B', hex(cpu.B)],
            ['SP', hex(cpu.SP)],
            ['PC', hex(cpu.PC, 4)],
            ['DPTR', hex(cpu.DPTR, 4)],
          ].map(([name, val]) => (
            <div key={name} className="flex items-center justify-between bg-surface-2 rounded px-2 py-1">
              <span className="text-muted-foreground font-medium">{name}</span>
              <span className="text-primary font-mono font-bold">{val}h</span>
            </div>
          ))}
        </div>
      </section>

      {/* Register Bank */}
      <section>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          R0-R7 <span className="text-primary">(Bank {bank})</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[0,1,2,3,4,5,6,7].map(n => (
            <div key={n} className="flex items-center justify-between bg-surface-2 rounded px-2 py-1">
              <span className="text-muted-foreground">R{n}</span>
              <span className="text-primary font-mono font-bold">{hex(getRn(cpu, n))}h</span>
            </div>
          ))}
        </div>
      </section>

      {/* PSW Flags */}
      <section>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          PSW <span className="text-primary">{hex(cpu.iram[0xD0])}h</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[
            ['CY', cpu.CY], ['AC', cpu.AC], ['F0', cpu.F0], ['RS1', cpu.RS1],
            ['RS0', cpu.RS0], ['OV', cpu.OV], ['-', false], ['P', cpu.P],
          ].map(([name, val], i) => (
            <div key={i} className={`text-center rounded py-1 text-[10px] font-bold ${val ? 'bg-success/20 text-success' : 'bg-surface-2 text-muted-foreground'}`}>
              {name as string}
              <div className="text-[9px] font-mono">{val ? '1' : '0'}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SFR Quick View */}
      <section>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">SFRs</div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          {[
            ['P0', hex(cpu.P0)], ['P1', hex(cpu.P1)], ['P2', hex(cpu.P2)], ['P3', hex(cpu.P3)],
            ['TMOD', hex(cpu.TMOD)], ['TCON', hex(cpu.TCON)],
            ['SCON', hex(cpu.SCON)], ['SBUF', hex(cpu.SBUF)],
            ['IE', hex(cpu.IE)], ['IP', hex(cpu.IP)],
          ].map(([name, val]) => (
            <div key={name} className="flex items-center justify-between bg-surface-2 rounded px-2 py-0.5">
              <span className="text-muted-foreground">{name}</span>
              <span className="text-foreground font-mono">{val}h</span>
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

  // Virtual scrolling for external memory (64K rows would be too many)
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
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface-2 shrink-0">
        <MemoryStick className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Memory</span>
        <div className="flex-1" />
        <button onClick={() => setMemType('internal')} className={`px-2 py-0.5 text-[10px] rounded ${memType === 'internal' ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-muted-foreground'}`}>
          INT
        </button>
        <button onClick={() => setMemType('external')} className={`px-2 py-0.5 text-[10px] rounded ${memType === 'external' ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-muted-foreground'}`}>
          EXT
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border shrink-0">
        <Search className="w-3 h-3 text-muted-foreground" />
        <input
          type="text"
          value={memSearch}
          onChange={e => setMemSearch(e.target.value)}
          placeholder={`Address (e.g. ${memType === 'internal' ? '30' : '0100'})...`}
          className="flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Grid */}
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
        <div key={row} className={`flex items-center hover:bg-surface-2 ${isSearchRow ? 'bg-primary/10' : ''}`}
          style={{ height: rowHeight }}>
          <div className="w-10 lg:w-12 text-right pr-1.5 text-muted-foreground shrink-0 font-semibold">
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
                  className="w-5 text-center bg-primary text-primary-foreground outline-none text-[10px] rounded"
                />
              );
            }

            return (
              <div key={c}
                onClick={() => { setEditingCell(addr); setEditValue(hex(val)); }}
                className={`w-5 text-center cursor-pointer hover:bg-primary/20 rounded-sm transition-colors
                  ${isSearched ? 'bg-warning/30 text-warning font-bold' : val !== 0 ? (isSFR ? 'text-syntax-register' : 'text-foreground') : 'text-muted-foreground/40'}`}
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
        <Lightbulb className="w-3.5 h-3.5 text-warning" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Port Monitor</span>
      </div>
      <div className="space-y-2">
        {ports.map(port => (
          <div key={port.name} className="bg-surface-2 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-foreground">{port.name} <span className="text-muted-foreground font-normal">({port.addr})</span></span>
              <span className="text-[10px] font-mono text-primary">{hex(port.val)}h</span>
            </div>
            <div className="flex gap-1 justify-center">
              {Array.from({ length: 8 }, (_, i) => {
                const bitOn = !!(port.val & (1 << (7 - i)));
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <div className={`w-4 h-4 rounded-full border transition-colors ${bitOn
                      ? 'bg-led-on border-led-on shadow-[0_0_6px_hsl(var(--led-on))]'
                      : 'bg-led-off border-border'}`}
                    />
                    <span className="text-[8px] text-muted-foreground">{7 - i}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Serial Console */}
      {cpu.serialOutput && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Serial (SBUF)</span>
          </div>
          <div className="bg-surface-2 rounded p-2 font-mono text-[11px] text-success min-h-[2rem]">
            {cpu.serialOutput}
          </div>
        </div>
      )}
    </div>
  );
}
