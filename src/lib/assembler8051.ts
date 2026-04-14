// 8051 Assembler

export interface AssemblerResult {
  success: boolean;
  code: Uint8Array;
  errors: AssemblerError[];
  symbols: Map<string, number>;
  lineToAddr: Map<number, number>;
  addrToLine: Map<number, number>;
}

export interface AssemblerError {
  line: number;
  message: string;
}

const REGISTERS: Record<string, number> = {
  'A': 0xE0, 'B': 0xF0, 'SP': 0x81, 'DPL': 0x82, 'DPH': 0x83,
  'P0': 0x80, 'P1': 0x90, 'P2': 0xA0, 'P3': 0xB0,
  'TMOD': 0x89, 'TCON': 0x88, 'TH0': 0x8C, 'TL0': 0x8A,
  'TH1': 0x8D, 'TL1': 0x8B, 'SCON': 0x98, 'SBUF': 0x99,
  'IE': 0xA8, 'IP': 0xB8, 'PSW': 0xD0, 'ACC': 0xE0, 'PCON': 0x87,
};

const BIT_ADDRESSES: Record<string, number> = {
  'CY': 0xD7, 'AC': 0xD6, 'F0': 0xD5, 'RS1': 0xD4, 'RS0': 0xD3,
  'OV': 0xD2, 'P': 0xD0,
  'P0.0': 0x80, 'P0.1': 0x81, 'P0.2': 0x82, 'P0.3': 0x83,
  'P0.4': 0x84, 'P0.5': 0x85, 'P0.6': 0x86, 'P0.7': 0x87,
  'P1.0': 0x90, 'P1.1': 0x91, 'P1.2': 0x92, 'P1.3': 0x93,
  'P1.4': 0x94, 'P1.5': 0x95, 'P1.6': 0x96, 'P1.7': 0x97,
  'P2.0': 0xA0, 'P2.1': 0xA1, 'P2.2': 0xA2, 'P2.3': 0xA3,
  'P2.4': 0xA4, 'P2.5': 0xA5, 'P2.6': 0xA6, 'P2.7': 0xA7,
  'P3.0': 0xB0, 'P3.1': 0xB1, 'P3.2': 0xB2, 'P3.3': 0xB3,
  'P3.4': 0xB4, 'P3.5': 0xB5, 'P3.6': 0xB6, 'P3.7': 0xB7,
  'ACC.0': 0xE0, 'ACC.1': 0xE1, 'ACC.2': 0xE2, 'ACC.3': 0xE3,
  'ACC.4': 0xE4, 'ACC.5': 0xE5, 'ACC.6': 0xE6, 'ACC.7': 0xE7,
  'B.0': 0xF0, 'B.1': 0xF1, 'B.2': 0xF2, 'B.3': 0xF3,
  'B.4': 0xF4, 'B.5': 0xF5, 'B.6': 0xF6, 'B.7': 0xF7,
  'TF1': 0x8F, 'TR1': 0x8E, 'TF0': 0x8D, 'TR0': 0x8C,
  'IE1': 0x8B, 'IT1': 0x8A, 'IE0': 0x89, 'IT0': 0x88,
  'EA': 0xAF, 'ES': 0xAC, 'ET1': 0xAB, 'EX1': 0xAA,
  'ET0': 0xA9, 'EX0': 0xA8,
};

function parseNumber(s: string, symbols: Map<string, number>): number | null {
  s = s.trim();
  // Handle __CURR_PC_N__ placeholders for $
  const currPcMatch = s.match(/^__CURR_PC_(\d+)__$/);
  if (currPcMatch) return parseInt(currPcMatch[1], 10);
  // Check symbol table
  if (symbols.has(s.toUpperCase())) return symbols.get(s.toUpperCase())!;
  // Check SFR names
  if (REGISTERS[s.toUpperCase()] !== undefined) return REGISTERS[s.toUpperCase()];
  // Check bit addresses
  if (BIT_ADDRESSES[s.toUpperCase()] !== undefined) return BIT_ADDRESSES[s.toUpperCase()];

  // Hex: 0FFH, 0xFF, FFh
  let m = s.match(/^0?([0-9A-Fa-f]+)[Hh]$/);
  if (m) return parseInt(m[1], 16);
  m = s.match(/^0[xX]([0-9A-Fa-f]+)$/);
  if (m) return parseInt(m[1], 16);
  // Binary: 10101010B
  m = s.match(/^([01]+)[Bb]$/);
  if (m) return parseInt(m[1], 2);
  // Decimal
  m = s.match(/^(\d+)[Dd]?$/);
  if (m) return parseInt(m[1], 10);
  // Character
  m = s.match(/^'(.)'$/);
  if (m) return m[1].charCodeAt(0);

  return null;
}

function isRn(s: string): number {
  const m = s.toUpperCase().match(/^R([0-7])$/);
  return m ? parseInt(m[1]) : -1;
}

function isIndirectRi(s: string): number {
  const m = s.toUpperCase().match(/^@R([01])$/);
  return m ? parseInt(m[1]) : -1;
}

function isImmediate(s: string): string | null {
  if (s.startsWith('#')) return s.substring(1);
  return null;
}

export function assemble(source: string): AssemblerResult {
  const errors: AssemblerError[] = [];
  const symbols = new Map<string, number>();
  const lineToAddr = new Map<number, number>();
  const addrToLine = new Map<number, number>();
  const code = new Uint8Array(65536);

  const lines = source.split('\n');

  // Pass 1: collect labels and symbols, calculate addresses
  let pc = 0;
  const parsedLines: Array<{
    lineNum: number;
    label?: string;
    mnemonic?: string;
    operands: string[];
    addr: number;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    // Remove comments
    const commentIdx = line.indexOf(';');
    if (commentIdx >= 0) line = line.substring(0, commentIdx).trim();
    if (!line) continue;

    // Handle $ as current PC address
    line = line.replace(/\$(?![a-zA-Z0-9_])/g, `__CURR_PC_${pc}__`);

    let label: string | undefined;
    let mnemonic: string | undefined;
    let operandsStr = '';

    // Check for label (ends with :)
    const labelMatch = line.match(/^(\w+):\s*(.*)/);
    if (labelMatch) {
      label = labelMatch[1].toUpperCase();
      line = labelMatch[2].trim();
    }

    if (line) {
      const parts = line.match(/^(\w+)\s*(.*)/);
      if (parts) {
        mnemonic = parts[1].toUpperCase();
        operandsStr = parts[2].trim();
      }
    }

    // Parse operands (split by comma, but respect strings)
    const operands: string[] = [];
    if (operandsStr) {
      let current = '';
      let inQuote = false;
      for (const ch of operandsStr) {
        if (ch === "'" && !inQuote) { inQuote = true; current += ch; }
        else if (ch === "'" && inQuote) { inQuote = false; current += ch; }
        else if (ch === ',' && !inQuote) {
          operands.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      if (current.trim()) operands.push(current.trim());
    }

    if (label) {
      if (mnemonic === 'EQU' && operands.length > 0) {
        const val = parseNumber(operands[0], symbols);
        if (val !== null) {
          symbols.set(label, val);
        } else {
          errors.push({ line: i + 1, message: `Invalid value for EQU: ${operands[0]}` });
        }
        continue;
      }
      symbols.set(label, pc);
    }

    if (!mnemonic) continue;

    // Handle directives
    if (mnemonic === 'ORG') {
      const val = parseNumber(operands[0], symbols);
      if (val !== null) pc = val;
      else errors.push({ line: i + 1, message: `Invalid ORG address: ${operands[0]}` });
      continue;
    }

    if (mnemonic === 'EQU') {
      errors.push({ line: i + 1, message: 'EQU requires a label' });
      continue;
    }

    if (mnemonic === 'DB') {
      const startPc = pc;
      for (const op of operands) {
        if (op.startsWith("'") && op.endsWith("'")) {
          for (let c = 1; c < op.length - 1; c++) {
            code[pc++] = op.charCodeAt(c);
          }
        } else {
          const val = parseNumber(op, symbols);
          if (val !== null) code[pc++] = val & 0xFF;
          else errors.push({ line: i + 1, message: `Invalid DB value: ${op}` });
        }
      }
      lineToAddr.set(i + 1, startPc);
      addrToLine.set(startPc, i + 1);
      continue;
    }

    if (mnemonic === 'DW') {
      const startPc = pc;
      for (const op of operands) {
        const val = parseNumber(op, symbols);
        if (val !== null) {
          code[pc++] = (val >> 8) & 0xFF;
          code[pc++] = val & 0xFF;
        } else errors.push({ line: i + 1, message: `Invalid DW value: ${op}` });
      }
      lineToAddr.set(i + 1, startPc);
      addrToLine.set(startPc, i + 1);
      continue;
    }

    if (mnemonic === 'END') continue;

    parsedLines.push({ lineNum: i + 1, label, mnemonic, operands, addr: pc });
    lineToAddr.set(i + 1, pc);
    addrToLine.set(pc, i + 1);

    // Estimate instruction size for pass 1
    pc += estimateSize(mnemonic, operands);
  }

  // Pass 2: generate code
  if (errors.length > 0) {
    return { success: false, code, errors, symbols, lineToAddr, addrToLine };
  }

  for (const pl of parsedLines) {
    let addr = pl.addr;
    const { mnemonic, operands, lineNum } = pl;

    try {
      const bytes = encodeInstruction(mnemonic!, operands, addr, symbols, lineNum, errors);
      for (const b of bytes) {
        code[addr++] = b;
      }
    } catch (e: any) {
      errors.push({ line: lineNum, message: e.message || `Failed to encode: ${mnemonic}` });
    }
  }

  return { success: errors.length === 0, code, errors, symbols, lineToAddr, addrToLine };
}

function estimateSize(mnemonic: string, operands: string[]): number {
  const op0 = operands[0]?.toUpperCase() || '';
  const op1 = operands[1]?.toUpperCase() || '';

  switch (mnemonic) {
    case 'NOP': case 'RET': case 'RETI': case 'RR': case 'RRC':
    case 'RL': case 'RLC': case 'SWAP': case 'DA': return 1;

    case 'CLR': case 'SETB': case 'CPL':
      if (op0 === 'A' || op0 === 'C') return 1;
      return 2;

    case 'INC': case 'DEC':
      if (op0 === 'A' || isRn(op0) >= 0 || isIndirectRi(op0) >= 0) return 1;
      if (op0 === 'DPTR') return 1;
      return 2;

    case 'MUL': case 'DIV': return 1;

    case 'ADD': case 'ADDC': case 'SUBB': case 'ANL': case 'ORL': case 'XRL':
      if (isImmediate(op1)) return 2;
      if (isRn(op1) >= 0 || isIndirectRi(op1) >= 0) return 1;
      if (op0 !== 'A' && op0 !== 'C') return 3; // direct, #data
      return 2;

    case 'MOV':
      if (op0 === 'DPTR') return 3;
      if (op0 === 'A' && isImmediate(op1)) return 2;
      if (op0 === 'A' && (isRn(op1) >= 0 || isIndirectRi(op1) >= 0)) return 1;
      if (op0 === 'A') return 2;
      if (isRn(op0) >= 0 && isImmediate(op1)) return 2;
      if (isRn(op0) >= 0) return 2;
      if (isIndirectRi(op0) >= 0 && isImmediate(op1)) return 2;
      if (isIndirectRi(op0) >= 0) return 2;
      if (op0 === 'C') return 2;
      if (op1 === 'C') return 2;
      // MOV direct, ...
      if (isImmediate(op1)) return 3;
      if (isRn(op1) >= 0 || isIndirectRi(op1) >= 0) return 2;
      if (op1 === 'A') return 2;
      return 3; // MOV direct, direct

    case 'MOVX': case 'MOVC': return 1;
    case 'PUSH': case 'POP': return 2;
    case 'XCH': case 'XCHD':
      if (isRn(op1) >= 0 || isIndirectRi(op1) >= 0) return 1;
      return 2;

    case 'LJMP': case 'LCALL': return 3;
    case 'AJMP': case 'ACALL': return 2;
    case 'SJMP': return 2;
    case 'JMP': return 1; // JMP @A+DPTR
    case 'JZ': case 'JNZ': case 'JC': case 'JNC': return 2;
    case 'JB': case 'JNB': case 'JBC': return 3;
    case 'DJNZ':
      if (isRn(op0) >= 0) return 2;
      return 3;
    case 'CJNE': return 3;

    default: return 1;
  }
}

function encodeInstruction(
  mnemonic: string, operands: string[], addr: number,
  symbols: Map<string, number>, lineNum: number, errors: AssemblerError[]
): number[] {
  const op = operands.map(o => o.trim());
  const op0u = op[0]?.toUpperCase() || '';
  const op1u = op[1]?.toUpperCase() || '';
  const op2u = op[2]?.toUpperCase() || '';

  const resolveVal = (s: string): number | null => parseNumber(s, symbols);

  const resolveBit = (s: string): number | null => {
    const su = s.toUpperCase();
    if (BIT_ADDRESSES[su] !== undefined) return BIT_ADDRESSES[su];
    return resolveVal(s);
  };

  const resolveDirect = (s: string): number | null => {
    const su = s.toUpperCase();
    if (REGISTERS[su] !== undefined) return REGISTERS[su];
    return resolveVal(s);
  };

  const err = (msg: string) => { errors.push({ line: lineNum, message: msg }); return [0x00]; };

  const calcRel = (target: number, instrLen: number): number => {
    const rel = target - (addr + instrLen);
    if (rel < -128 || rel > 127) {
      errors.push({ line: lineNum, message: `Branch target out of range: ${rel}` });
      return 0;
    }
    return rel & 0xFF;
  };

  switch (mnemonic) {
    case 'NOP': return [0x00];

    case 'RR': return [0x03];
    case 'RRC': return [0x13];
    case 'RL': return [0x23];
    case 'RLC': return [0x33];
    case 'SWAP': return [0xC4];
    case 'DA': return [0xD4];
    case 'RET': return [0x22];
    case 'RETI': return [0x32];

    case 'CLR':
      if (op0u === 'A') return [0xE4];
      if (op0u === 'C') return [0xC3];
      { const b = resolveBit(op[0]); if (b !== null) return [0xC2, b]; }
      return err(`Invalid operand for CLR: ${op[0]}`);

    case 'SETB':
      if (op0u === 'C') return [0xD3];
      { const b = resolveBit(op[0]); if (b !== null) return [0xD2, b]; }
      return err(`Invalid operand for SETB: ${op[0]}`);

    case 'CPL':
      if (op0u === 'A') return [0xF4];
      if (op0u === 'C') return [0xB3];
      { const b = resolveBit(op[0]); if (b !== null) return [0xB2, b]; }
      return err(`Invalid operand for CPL: ${op[0]}`);

    case 'INC':
      if (op0u === 'A') return [0x04];
      if (op0u === 'DPTR') return [0xA3];
      { const rn = isRn(op0u); if (rn >= 0) return [0x08 + rn]; }
      { const ri = isIndirectRi(op0u); if (ri >= 0) return [0x06 + ri]; }
      { const d = resolveDirect(op[0]); if (d !== null) return [0x05, d]; }
      return err(`Invalid operand for INC: ${op[0]}`);

    case 'DEC':
      if (op0u === 'A') return [0x14];
      { const rn = isRn(op0u); if (rn >= 0) return [0x18 + rn]; }
      { const ri = isIndirectRi(op0u); if (ri >= 0) return [0x16 + ri]; }
      { const d = resolveDirect(op[0]); if (d !== null) return [0x15, d]; }
      return err(`Invalid operand for DEC: ${op[0]}`);

    case 'MUL': return [0xA4];
    case 'DIV': return [0x84];

    case 'ADD': case 'ADDC': case 'SUBB': {
      if (op0u !== 'A') return err(`${mnemonic} first operand must be A`);
      const base = mnemonic === 'ADD' ? 0x24 : mnemonic === 'ADDC' ? 0x34 : 0x94;
      const imm = isImmediate(op[1]);
      if (imm) { const v = resolveVal(imm); if (v !== null) return [base, v & 0xFF]; }
      { const rn = isRn(op1u); if (rn >= 0) return [base + 4 + rn]; }
      { const ri = isIndirectRi(op1u); if (ri >= 0) return [base + 2 + ri]; }
      { const d = resolveDirect(op[1]); if (d !== null) return [base + 1, d]; }
      return err(`Invalid operand for ${mnemonic}: ${op[1]}`);
    }

    case 'ANL': case 'ORL': case 'XRL': {
      const baseMap: Record<string, number> = { 'ANL': 0x50, 'ORL': 0x40, 'XRL': 0x60 };
      const b = baseMap[mnemonic];

      if (op0u === 'A') {
        const imm = isImmediate(op[1]);
        if (imm) { const v = resolveVal(imm); if (v !== null) return [b + 4, v & 0xFF]; }
        { const rn = isRn(op1u); if (rn >= 0) return [b + 8 + rn]; }
        { const ri = isIndirectRi(op1u); if (ri >= 0) return [b + 6 + ri]; }
        { const d = resolveDirect(op[1]); if (d !== null) return [b + 5, d]; }
      } else if (op0u === 'C') {
        // Boolean operations
        const notBit = op[1]?.startsWith('/');
        const bitStr = notBit ? op[1].substring(1) : op[1];
        const bitVal = resolveBit(bitStr);
        if (bitVal !== null) {
          if (mnemonic === 'ANL') return notBit ? [0xB0, bitVal] : [0x82, bitVal];
          if (mnemonic === 'ORL') return notBit ? [0xA0, bitVal] : [0x72, bitVal];
        }
      } else {
        // direct, A or direct, #data
        const d = resolveDirect(op[0]);
        if (d !== null) {
          if (op1u === 'A') return [b + 2, d];
          const imm = isImmediate(op[1]);
          if (imm) { const v = resolveVal(imm); if (v !== null) return [b + 3, d, v & 0xFF]; }
        }
      }
      return err(`Invalid operands for ${mnemonic}`);
    }

    case 'MOV': {
      if (op0u === 'A') {
        const imm = isImmediate(op[1]);
        if (imm) { const v = resolveVal(imm); if (v !== null) return [0x74, v & 0xFF]; }
        { const rn = isRn(op1u); if (rn >= 0) return [0xE8 + rn]; }
        { const ri = isIndirectRi(op1u); if (ri >= 0) return [0xE6 + ri]; }
        { const d = resolveDirect(op[1]); if (d !== null) return [0xE5, d]; }
      } else if (op0u === 'DPTR') {
        const imm = isImmediate(op[1]);
        if (imm) {
          const v = resolveVal(imm);
          if (v !== null) return [0x90, (v >> 8) & 0xFF, v & 0xFF];
        }
      } else if (op0u === 'C') {
        const b = resolveBit(op[1]); if (b !== null) return [0xA2, b];
      } else if (isRn(op0u) >= 0) {
        const rn = isRn(op0u);
        const imm = isImmediate(op[1]);
        if (imm) { const v = resolveVal(imm); if (v !== null) return [0x78 + rn, v & 0xFF]; }
        if (op1u === 'A') return [0xF8 + rn];
        { const d = resolveDirect(op[1]); if (d !== null) return [0xA8 + rn, d]; }
      } else if (isIndirectRi(op0u) >= 0) {
        const ri = isIndirectRi(op0u);
        const imm = isImmediate(op[1]);
        if (imm) { const v = resolveVal(imm); if (v !== null) return [0x76 + ri, v & 0xFF]; }
        if (op1u === 'A') return [0xF6 + ri];
        { const d = resolveDirect(op[1]); if (d !== null) return [0xA6 + ri, d]; }
      } else {
        // MOV direct, ...
        const dst = resolveDirect(op[0]);
        if (dst !== null) {
          if (op1u === 'A') return [0xF5, dst];
          const imm = isImmediate(op[1]);
          if (imm) { const v = resolveVal(imm); if (v !== null) return [0x75, dst, v & 0xFF]; }
          { const rn = isRn(op1u); if (rn >= 0) return [0x88 + rn, dst]; }
          { const ri = isIndirectRi(op1u); if (ri >= 0) return [0x86 + ri, dst]; }
          if (op1u === 'C') return [0x92, dst]; // MOV bit, C - treat direct as bit
          // MOV direct, direct
          const src = resolveDirect(op[1]);
          if (src !== null) return [0x85, src, dst];
        }
      }
      return err(`Invalid operands for MOV: ${op.join(', ')}`);
    }

    case 'MOVX':
      if (op0u === 'A') {
        if (op1u === '@DPTR') return [0xE0];
        { const ri = isIndirectRi(op1u); if (ri >= 0) return [0xE2 + ri]; }
      } else if (op0u === '@DPTR') {
        if (op1u === 'A') return [0xF0];
      } else {
        const ri = isIndirectRi(op0u);
        if (ri >= 0 && op1u === 'A') return [0xF2 + ri];
      }
      return err(`Invalid operands for MOVX`);

    case 'MOVC':
      if (op0u === 'A') {
        if (op1u === '@A+DPTR') return [0x93];
        if (op1u === '@A+PC') return [0x83];
      }
      return err(`Invalid operands for MOVC`);

    case 'PUSH': {
      const d = resolveDirect(op[0]); if (d !== null) return [0xC0, d];
      return err(`Invalid operand for PUSH: ${op[0]}`);
    }

    case 'POP': {
      const d = resolveDirect(op[0]); if (d !== null) return [0xD0, d];
      return err(`Invalid operand for POP: ${op[0]}`);
    }

    case 'XCH': {
      if (op0u !== 'A') return err('XCH first operand must be A');
      { const rn = isRn(op1u); if (rn >= 0) return [0xC8 + rn]; }
      { const ri = isIndirectRi(op1u); if (ri >= 0) return [0xC6 + ri]; }
      { const d = resolveDirect(op[1]); if (d !== null) return [0xC5, d]; }
      return err(`Invalid operand for XCH: ${op[1]}`);
    }

    case 'XCHD': {
      if (op0u !== 'A') return err('XCHD first operand must be A');
      { const ri = isIndirectRi(op1u); if (ri >= 0) return [0xD6 + ri]; }
      return err(`Invalid operand for XCHD: ${op[1]}`);
    }

    case 'LJMP': {
      const target = resolveVal(op[0]);
      if (target !== null) return [0x02, (target >> 8) & 0xFF, target & 0xFF];
      return err(`Invalid target for LJMP: ${op[0]}`);
    }

    case 'SJMP': {
      const target = resolveVal(op[0]);
      if (target !== null) return [0x80, calcRel(target, 2)];
      return err(`Invalid target for SJMP: ${op[0]}`);
    }

    case 'AJMP': {
      const target = resolveVal(op[0]);
      if (target !== null) {
        const page = (target >> 8) & 0x07;
        return [0x01 | (page << 5), target & 0xFF];
      }
      return err(`Invalid target for AJMP: ${op[0]}`);
    }

    case 'LCALL': {
      const target = resolveVal(op[0]);
      if (target !== null) return [0x12, (target >> 8) & 0xFF, target & 0xFF];
      return err(`Invalid target for LCALL: ${op[0]}`);
    }

    case 'ACALL': {
      const target = resolveVal(op[0]);
      if (target !== null) {
        const page = (target >> 8) & 0x07;
        return [0x11 | (page << 5), target & 0xFF];
      }
      return err(`Invalid target for ACALL: ${op[0]}`);
    }

    case 'JMP': return [0x73]; // JMP @A+DPTR

    case 'JZ': {
      const target = resolveVal(op[0]);
      if (target !== null) return [0x60, calcRel(target, 2)];
      return err(`Invalid target for JZ: ${op[0]}`);
    }

    case 'JNZ': {
      const target = resolveVal(op[0]);
      if (target !== null) return [0x70, calcRel(target, 2)];
      return err(`Invalid target for JNZ: ${op[0]}`);
    }

    case 'JC': {
      const target = resolveVal(op[0]);
      if (target !== null) return [0x40, calcRel(target, 2)];
      return err(`Invalid target for JC: ${op[0]}`);
    }

    case 'JNC': {
      const target = resolveVal(op[0]);
      if (target !== null) return [0x50, calcRel(target, 2)];
      return err(`Invalid target for JNC: ${op[0]}`);
    }

    case 'JB': {
      const bit = resolveBit(op[0]);
      const target = resolveVal(op[1]);
      if (bit !== null && target !== null) return [0x20, bit, calcRel(target, 3)];
      return err(`Invalid operands for JB`);
    }

    case 'JNB': {
      const bit = resolveBit(op[0]);
      const target = resolveVal(op[1]);
      if (bit !== null && target !== null) return [0x30, bit, calcRel(target, 3)];
      return err(`Invalid operands for JNB`);
    }

    case 'JBC': {
      const bit = resolveBit(op[0]);
      const target = resolveVal(op[1]);
      if (bit !== null && target !== null) return [0x10, bit, calcRel(target, 3)];
      return err(`Invalid operands for JBC`);
    }

    case 'DJNZ': {
      const target = resolveVal(op[1]);
      if (target === null) return err(`Invalid target for DJNZ: ${op[1]}`);
      { const rn = isRn(op0u); if (rn >= 0) return [0xD8 + rn, calcRel(target, 2)]; }
      { const d = resolveDirect(op[0]); if (d !== null) return [0xD5, d, calcRel(target, 3)]; }
      return err(`Invalid operand for DJNZ: ${op[0]}`);
    }

    case 'CJNE': {
      const target = resolveVal(op[2]);
      if (target === null) return err(`Invalid target for CJNE: ${op[2]}`);
      if (op0u === 'A') {
        const imm = isImmediate(op[1]);
        if (imm) {
          const v = resolveVal(imm);
          if (v !== null) return [0xB4, v & 0xFF, calcRel(target, 3)];
        }
        const d = resolveDirect(op[1]);
        if (d !== null) return [0xB5, d, calcRel(target, 3)];
      }
      { const ri = isIndirectRi(op0u);
        if (ri >= 0) {
          const imm = isImmediate(op[1]);
          if (imm) {
            const v = resolveVal(imm);
            if (v !== null) return [0xB6 + ri, v & 0xFF, calcRel(target, 3)];
          }
        }
      }
      { const rn = isRn(op0u);
        if (rn >= 0) {
          const imm = isImmediate(op[1]);
          if (imm) {
            const v = resolveVal(imm);
            if (v !== null) return [0xB8 + rn, v & 0xFF, calcRel(target, 3)];
          }
        }
      }
      return err(`Invalid operands for CJNE`);
    }

    default:
      return err(`Unknown instruction: ${mnemonic}`);
  }
}
