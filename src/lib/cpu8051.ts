// 8051 CPU Emulation Engine

export interface CPUState {
  // Main registers
  A: number;   // Accumulator
  B: number;   // B register
  SP: number;  // Stack Pointer
  PC: number;  // Program Counter
  DPTR: number; // Data Pointer (DPH:DPL)

  // PSW flags
  CY: boolean;
  AC: boolean;
  F0: boolean;
  RS1: boolean;
  RS0: boolean;
  OV: boolean;
  P: boolean;   // Parity

  // Internal RAM (256 bytes: lower 128 + upper 128/SFRs)
  iram: Uint8Array;
  // External RAM (64KB)
  xram: Uint8Array;
  // Code memory (64KB)
  code: Uint8Array;

  // SFR map (direct addresses 80h-FFh)
  // Ports
  P0: number;
  P1: number;
  P2: number;
  P3: number;
  // Timer
  TMOD: number;
  TCON: number;
  TH0: number;
  TL0: number;
  TH1: number;
  TL1: number;
  // Serial
  SCON: number;
  SBUF: number;
  // Interrupt
  IE: number;
  IP: number;
  // Power
  PCON: number;

  running: boolean;
  halted: boolean;
  cycles: number;
  serialOutput: string;
}

export function createCPU(): CPUState {
  const cpu: CPUState = {
    A: 0, B: 0, SP: 0x07, PC: 0, DPTR: 0,
    CY: false, AC: false, F0: false, RS1: false, RS0: false, OV: false, P: false,
    iram: new Uint8Array(256),
    xram: new Uint8Array(65536),
    code: new Uint8Array(65536),
    P0: 0xFF, P1: 0xFF, P2: 0xFF, P3: 0xFF,
    TMOD: 0, TCON: 0, TH0: 0, TL0: 0, TH1: 0, TL1: 0,
    SCON: 0, SBUF: 0, IE: 0, IP: 0, PCON: 0,
    running: false, halted: false, cycles: 0, serialOutput: '',
  };
  syncSFRsToRAM(cpu);
  return cpu;
}

export function resetCPU(cpu: CPUState): void {
  cpu.A = 0; cpu.B = 0; cpu.SP = 0x07; cpu.PC = 0; cpu.DPTR = 0;
  cpu.CY = false; cpu.AC = false; cpu.F0 = false;
  cpu.RS1 = false; cpu.RS0 = false; cpu.OV = false; cpu.P = false;
  cpu.iram.fill(0);
  cpu.xram.fill(0);
  cpu.P0 = 0xFF; cpu.P1 = 0xFF; cpu.P2 = 0xFF; cpu.P3 = 0xFF;
  cpu.TMOD = 0; cpu.TCON = 0; cpu.TH0 = 0; cpu.TL0 = 0; cpu.TH1 = 0; cpu.TL1 = 0;
  cpu.SCON = 0; cpu.SBUF = 0; cpu.IE = 0; cpu.IP = 0; cpu.PCON = 0;
  cpu.running = false; cpu.halted = false; cpu.cycles = 0; cpu.serialOutput = '';
  syncSFRsToRAM(cpu);
}

function computeParity(val: number): boolean {
  let p = 0; let v = val & 0xFF;
  while (v) { p ^= (v & 1); v >>= 1; }
  return p === 1;
}

export function updatePSW(cpu: CPUState): void {
  cpu.P = computeParity(cpu.A);
  const psw = (cpu.CY ? 0x80 : 0) | (cpu.AC ? 0x40 : 0) | (cpu.F0 ? 0x20 : 0) |
    (cpu.RS1 ? 0x10 : 0) | (cpu.RS0 ? 0x08 : 0) | (cpu.OV ? 0x04 : 0) | (cpu.P ? 0x01 : 0);
  cpu.iram[0xD0] = psw;
}

function getPSWFromRAM(cpu: CPUState): void {
  const psw = cpu.iram[0xD0];
  cpu.CY = !!(psw & 0x80); cpu.AC = !!(psw & 0x40); cpu.F0 = !!(psw & 0x20);
  cpu.RS1 = !!(psw & 0x10); cpu.RS0 = !!(psw & 0x08); cpu.OV = !!(psw & 0x04);
  cpu.P = !!(psw & 0x01);
}

function getRegBank(cpu: CPUState): number {
  return ((cpu.RS1 ? 1 : 0) << 1) | (cpu.RS0 ? 1 : 0);
}

export function getRn(cpu: CPUState, n: number): number {
  return cpu.iram[getRegBank(cpu) * 8 + n];
}

export function setRn(cpu: CPUState, n: number, val: number): void {
  cpu.iram[getRegBank(cpu) * 8 + n] = val & 0xFF;
}

export function syncSFRsToRAM(cpu: CPUState): void {
  cpu.iram[0xE0] = cpu.A;
  cpu.iram[0xF0] = cpu.B;
  cpu.iram[0x81] = cpu.SP;
  cpu.iram[0x82] = cpu.DPTR & 0xFF; // DPL
  cpu.iram[0x83] = (cpu.DPTR >> 8) & 0xFF; // DPH
  cpu.iram[0x80] = cpu.P0;
  cpu.iram[0x90] = cpu.P1;
  cpu.iram[0xA0] = cpu.P2;
  cpu.iram[0xB0] = cpu.P3;
  cpu.iram[0x89] = cpu.TMOD;
  cpu.iram[0x88] = cpu.TCON;
  cpu.iram[0x8C] = cpu.TH0;
  cpu.iram[0x8A] = cpu.TL0;
  cpu.iram[0x8D] = cpu.TH1;
  cpu.iram[0x8B] = cpu.TL1;
  cpu.iram[0x98] = cpu.SCON;
  cpu.iram[0x99] = cpu.SBUF;
  cpu.iram[0xA8] = cpu.IE;
  cpu.iram[0xB8] = cpu.IP;
  cpu.iram[0x87] = cpu.PCON;
  updatePSW(cpu);
}

export function syncRAMToSFRs(cpu: CPUState): void {
  cpu.A = cpu.iram[0xE0];
  cpu.B = cpu.iram[0xF0];
  cpu.SP = cpu.iram[0x81];
  cpu.DPTR = (cpu.iram[0x83] << 8) | cpu.iram[0x82];
  cpu.P0 = cpu.iram[0x80];
  cpu.P1 = cpu.iram[0x90];
  cpu.P2 = cpu.iram[0xA0];
  cpu.P3 = cpu.iram[0xB0];
  cpu.TMOD = cpu.iram[0x89];
  cpu.TCON = cpu.iram[0x88];
  cpu.TH0 = cpu.iram[0x8C];
  cpu.TL0 = cpu.iram[0x8A];
  cpu.TH1 = cpu.iram[0x8D];
  cpu.TL1 = cpu.iram[0x8B];
  cpu.SCON = cpu.iram[0x98];
  cpu.SBUF = cpu.iram[0x99];
  cpu.IE = cpu.iram[0xA8];
  cpu.IP = cpu.iram[0xB8];
  cpu.PCON = cpu.iram[0x87];
  getPSWFromRAM(cpu);
}

// Read direct address
function readDirect(cpu: CPUState, addr: number): number {
  return cpu.iram[addr & 0xFF];
}

// Write direct address
function writeDirect(cpu: CPUState, addr: number, val: number): void {
  cpu.iram[addr & 0xFF] = val & 0xFF;
  if (addr >= 0x80) syncRAMToSFRs(cpu);
}

// Read indirect (lower 128 only for @Ri)
function readIndirect(cpu: CPUState, addr: number): number {
  return cpu.iram[addr & 0x7F];
}

function writeIndirect(cpu: CPUState, addr: number, val: number): void {
  cpu.iram[addr & 0x7F] = val & 0xFF;
}

// Bit addressing
function getBitAddr(bitAddr: number): { byteAddr: number; bitNum: number } {
  if (bitAddr < 0x80) {
    return { byteAddr: 0x20 + Math.floor(bitAddr / 8), bitNum: bitAddr % 8 };
  } else {
    const base = bitAddr & 0xF8;
    return { byteAddr: base, bitNum: bitAddr & 0x07 };
  }
}

function readBit(cpu: CPUState, bitAddr: number): boolean {
  const { byteAddr, bitNum } = getBitAddr(bitAddr);
  return !!(readDirect(cpu, byteAddr) & (1 << bitNum));
}

function writeBit(cpu: CPUState, bitAddr: number, val: boolean): void {
  const { byteAddr, bitNum } = getBitAddr(bitAddr);
  let byte = readDirect(cpu, byteAddr);
  if (val) byte |= (1 << bitNum);
  else byte &= ~(1 << bitNum);
  writeDirect(cpu, byteAddr, byte);
}

// Push/Pop
function push(cpu: CPUState, val: number): void {
  cpu.SP = (cpu.SP + 1) & 0xFF;
  cpu.iram[cpu.SP] = val & 0xFF;
  cpu.iram[0x81] = cpu.SP;
}

function pop(cpu: CPUState): number {
  const val = cpu.iram[cpu.SP];
  cpu.SP = (cpu.SP - 1) & 0xFF;
  cpu.iram[0x81] = cpu.SP;
  return val;
}

function fetchByte(cpu: CPUState): number {
  const val = cpu.code[cpu.PC];
  cpu.PC = (cpu.PC + 1) & 0xFFFF;
  return val;
}

function toSigned8(v: number): number {
  return v > 127 ? v - 256 : v;
}

// Execute one instruction, return cycles consumed
export function executeInstruction(cpu: CPUState): number {
  if (cpu.halted) return 0;

  const opcode = fetchByte(cpu);
  let cycles = 1;

  switch (opcode) {
    case 0x00: // NOP
      break;

    // AJMP addr11 (pages 0-7)
    case 0x01: case 0x21: case 0x41: case 0x61:
    case 0x81: case 0xA1: case 0xC1: case 0xE1: {
      const lo = fetchByte(cpu);
      const page = (opcode >> 5) & 0x07;
      cpu.PC = (cpu.PC & 0xF800) | (page << 8) | lo;
      cycles = 2;
      break;
    }

    case 0x02: { // LJMP addr16
      const hi = fetchByte(cpu);
      const lo = fetchByte(cpu);
      cpu.PC = (hi << 8) | lo;
      cycles = 2;
      break;
    }

    case 0x03: // RR A
      cpu.A = ((cpu.A >> 1) | ((cpu.A & 1) << 7)) & 0xFF;
      break;

    case 0x04: // INC A
      cpu.A = (cpu.A + 1) & 0xFF;
      break;

    case 0x05: { // INC direct
      const addr = fetchByte(cpu);
      writeDirect(cpu, addr, readDirect(cpu, addr) + 1);
      break;
    }

    case 0x06: case 0x07: { // INC @Ri
      const ri = getRn(cpu, opcode & 1);
      writeIndirect(cpu, ri, readIndirect(cpu, ri) + 1);
      break;
    }

    case 0x08: case 0x09: case 0x0A: case 0x0B:
    case 0x0C: case 0x0D: case 0x0E: case 0x0F: { // INC Rn
      const n = opcode & 0x07;
      setRn(cpu, n, getRn(cpu, n) + 1);
      break;
    }

    case 0x10: { // JBC bit, rel
      const bit = fetchByte(cpu);
      const rel = toSigned8(fetchByte(cpu));
      if (readBit(cpu, bit)) {
        writeBit(cpu, bit, false);
        cpu.PC = (cpu.PC + rel) & 0xFFFF;
      }
      cycles = 2;
      break;
    }

    // ACALL addr11
    case 0x11: case 0x31: case 0x51: case 0x71:
    case 0x91: case 0xB1: case 0xD1: case 0xF1: {
      const lo = fetchByte(cpu);
      const page = (opcode >> 5) & 0x07;
      push(cpu, cpu.PC & 0xFF);
      push(cpu, (cpu.PC >> 8) & 0xFF);
      cpu.PC = (cpu.PC & 0xF800) | (page << 8) | lo;
      cycles = 2;
      break;
    }

    case 0x12: { // LCALL addr16
      const hi = fetchByte(cpu);
      const lo = fetchByte(cpu);
      push(cpu, cpu.PC & 0xFF);
      push(cpu, (cpu.PC >> 8) & 0xFF);
      cpu.PC = (hi << 8) | lo;
      cycles = 2;
      break;
    }

    case 0x13: { // RRC A
      const c = cpu.CY ? 0x80 : 0;
      cpu.CY = !!(cpu.A & 1);
      cpu.A = (cpu.A >> 1) | c;
      break;
    }

    case 0x14: // DEC A
      cpu.A = (cpu.A - 1) & 0xFF;
      break;

    case 0x15: { // DEC direct
      const addr = fetchByte(cpu);
      writeDirect(cpu, addr, readDirect(cpu, addr) - 1);
      break;
    }

    case 0x16: case 0x17: { // DEC @Ri
      const ri = getRn(cpu, opcode & 1);
      writeIndirect(cpu, ri, readIndirect(cpu, ri) - 1);
      break;
    }

    case 0x18: case 0x19: case 0x1A: case 0x1B:
    case 0x1C: case 0x1D: case 0x1E: case 0x1F: { // DEC Rn
      const n = opcode & 0x07;
      setRn(cpu, n, getRn(cpu, n) - 1);
      break;
    }

    case 0x20: { // JB bit, rel
      const bit = fetchByte(cpu);
      const rel = toSigned8(fetchByte(cpu));
      if (readBit(cpu, bit)) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0x22: { // RET
      const hi = pop(cpu);
      const lo = pop(cpu);
      cpu.PC = (hi << 8) | lo;
      cycles = 2;
      break;
    }

    case 0x23: { // RL A
      cpu.A = ((cpu.A << 1) | ((cpu.A >> 7) & 1)) & 0xFF;
      break;
    }

    case 0x24: { // ADD A, #data
      const data = fetchByte(cpu);
      addToA(cpu, data);
      break;
    }

    case 0x25: { // ADD A, direct
      const addr = fetchByte(cpu);
      addToA(cpu, readDirect(cpu, addr));
      break;
    }

    case 0x26: case 0x27: { // ADD A, @Ri
      const ri = getRn(cpu, opcode & 1);
      addToA(cpu, readIndirect(cpu, ri));
      break;
    }

    case 0x28: case 0x29: case 0x2A: case 0x2B:
    case 0x2C: case 0x2D: case 0x2E: case 0x2F: { // ADD A, Rn
      addToA(cpu, getRn(cpu, opcode & 0x07));
      break;
    }

    case 0x30: { // JNB bit, rel
      const bit = fetchByte(cpu);
      const rel = toSigned8(fetchByte(cpu));
      if (!readBit(cpu, bit)) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0x32: { // RETI
      const hi = pop(cpu);
      const lo = pop(cpu);
      cpu.PC = (hi << 8) | lo;
      cycles = 2;
      break;
    }

    case 0x33: { // RLC A
      const c = cpu.CY ? 1 : 0;
      cpu.CY = !!(cpu.A & 0x80);
      cpu.A = ((cpu.A << 1) | c) & 0xFF;
      break;
    }

    case 0x34: { // ADDC A, #data
      const data = fetchByte(cpu);
      addcToA(cpu, data);
      break;
    }

    case 0x35: { // ADDC A, direct
      const addr = fetchByte(cpu);
      addcToA(cpu, readDirect(cpu, addr));
      break;
    }

    case 0x36: case 0x37: { // ADDC A, @Ri
      const ri = getRn(cpu, opcode & 1);
      addcToA(cpu, readIndirect(cpu, ri));
      break;
    }

    case 0x38: case 0x39: case 0x3A: case 0x3B:
    case 0x3C: case 0x3D: case 0x3E: case 0x3F: { // ADDC A, Rn
      addcToA(cpu, getRn(cpu, opcode & 0x07));
      break;
    }

    case 0x40: { // JC rel
      const rel = toSigned8(fetchByte(cpu));
      if (cpu.CY) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0x42: { // ORL direct, A
      const addr = fetchByte(cpu);
      writeDirect(cpu, addr, readDirect(cpu, addr) | cpu.A);
      break;
    }

    case 0x43: { // ORL direct, #data
      const addr = fetchByte(cpu);
      const data = fetchByte(cpu);
      writeDirect(cpu, addr, readDirect(cpu, addr) | data);
      cycles = 2;
      break;
    }

    case 0x44: { // ORL A, #data
      cpu.A |= fetchByte(cpu);
      break;
    }

    case 0x45: { // ORL A, direct
      const addr = fetchByte(cpu);
      cpu.A |= readDirect(cpu, addr);
      break;
    }

    case 0x46: case 0x47: { // ORL A, @Ri
      const ri = getRn(cpu, opcode & 1);
      cpu.A |= readIndirect(cpu, ri);
      break;
    }

    case 0x48: case 0x49: case 0x4A: case 0x4B:
    case 0x4C: case 0x4D: case 0x4E: case 0x4F: { // ORL A, Rn
      cpu.A |= getRn(cpu, opcode & 0x07);
      break;
    }

    case 0x50: { // JNC rel
      const rel = toSigned8(fetchByte(cpu));
      if (!cpu.CY) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0x52: { // ANL direct, A
      const addr = fetchByte(cpu);
      writeDirect(cpu, addr, readDirect(cpu, addr) & cpu.A);
      break;
    }

    case 0x53: { // ANL direct, #data
      const addr = fetchByte(cpu);
      const data = fetchByte(cpu);
      writeDirect(cpu, addr, readDirect(cpu, addr) & data);
      cycles = 2;
      break;
    }

    case 0x54: { // ANL A, #data
      cpu.A &= fetchByte(cpu);
      break;
    }

    case 0x55: { // ANL A, direct
      const addr = fetchByte(cpu);
      cpu.A &= readDirect(cpu, addr);
      break;
    }

    case 0x56: case 0x57: { // ANL A, @Ri
      const ri = getRn(cpu, opcode & 1);
      cpu.A &= readIndirect(cpu, ri);
      break;
    }

    case 0x58: case 0x59: case 0x5A: case 0x5B:
    case 0x5C: case 0x5D: case 0x5E: case 0x5F: { // ANL A, Rn
      cpu.A &= getRn(cpu, opcode & 0x07);
      break;
    }

    case 0x60: { // JZ rel
      const rel = toSigned8(fetchByte(cpu));
      if (cpu.A === 0) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0x62: { // XRL direct, A
      const addr = fetchByte(cpu);
      writeDirect(cpu, addr, readDirect(cpu, addr) ^ cpu.A);
      break;
    }

    case 0x63: { // XRL direct, #data
      const addr = fetchByte(cpu);
      const data = fetchByte(cpu);
      writeDirect(cpu, addr, readDirect(cpu, addr) ^ data);
      cycles = 2;
      break;
    }

    case 0x64: { // XRL A, #data
      cpu.A ^= fetchByte(cpu);
      break;
    }

    case 0x65: { // XRL A, direct
      const addr = fetchByte(cpu);
      cpu.A ^= readDirect(cpu, addr);
      break;
    }

    case 0x66: case 0x67: { // XRL A, @Ri
      const ri = getRn(cpu, opcode & 1);
      cpu.A ^= readIndirect(cpu, ri);
      break;
    }

    case 0x68: case 0x69: case 0x6A: case 0x6B:
    case 0x6C: case 0x6D: case 0x6E: case 0x6F: { // XRL A, Rn
      cpu.A ^= getRn(cpu, opcode & 0x07);
      break;
    }

    case 0x70: { // JNZ rel
      const rel = toSigned8(fetchByte(cpu));
      if (cpu.A !== 0) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0x72: { // ORL C, bit
      const bit = fetchByte(cpu);
      cpu.CY = cpu.CY || readBit(cpu, bit);
      cycles = 2;
      break;
    }

    case 0x73: { // JMP @A+DPTR
      cpu.PC = (cpu.A + cpu.DPTR) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0x74: { // MOV A, #data
      cpu.A = fetchByte(cpu);
      break;
    }

    case 0x75: { // MOV direct, #data
      const addr = fetchByte(cpu);
      const data = fetchByte(cpu);
      writeDirect(cpu, addr, data);
      cycles = 2;
      break;
    }

    case 0x76: case 0x77: { // MOV @Ri, #data
      const ri = getRn(cpu, opcode & 1);
      const data = fetchByte(cpu);
      writeIndirect(cpu, ri, data);
      break;
    }

    case 0x78: case 0x79: case 0x7A: case 0x7B:
    case 0x7C: case 0x7D: case 0x7E: case 0x7F: { // MOV Rn, #data
      setRn(cpu, opcode & 0x07, fetchByte(cpu));
      break;
    }

    case 0x80: { // SJMP rel
      const rel = toSigned8(fetchByte(cpu));
      cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0x82: { // ANL C, bit
      const bit = fetchByte(cpu);
      cpu.CY = cpu.CY && readBit(cpu, bit);
      cycles = 2;
      break;
    }

    case 0x83: { // MOVC A, @A+PC
      cpu.A = cpu.code[(cpu.A + cpu.PC) & 0xFFFF];
      cycles = 2;
      break;
    }

    case 0x84: { // DIV AB
      if (cpu.B === 0) {
        cpu.OV = true;
        cpu.CY = false;
      } else {
        const q = Math.floor(cpu.A / cpu.B);
        const r = cpu.A % cpu.B;
        cpu.A = q & 0xFF;
        cpu.B = r & 0xFF;
        cpu.CY = false;
        cpu.OV = false;
      }
      cycles = 4;
      break;
    }

    case 0x85: { // MOV direct, direct
      const src = fetchByte(cpu);
      const dst = fetchByte(cpu);
      writeDirect(cpu, dst, readDirect(cpu, src));
      cycles = 2;
      break;
    }

    case 0x86: case 0x87: { // MOV direct, @Ri
      const addr = fetchByte(cpu);
      const ri = getRn(cpu, opcode & 1);
      writeDirect(cpu, addr, readIndirect(cpu, ri));
      cycles = 2;
      break;
    }

    case 0x88: case 0x89: case 0x8A: case 0x8B:
    case 0x8C: case 0x8D: case 0x8E: case 0x8F: { // MOV direct, Rn
      const addr = fetchByte(cpu);
      writeDirect(cpu, addr, getRn(cpu, opcode & 0x07));
      cycles = 2;
      break;
    }

    case 0x90: { // MOV DPTR, #data16
      const hi = fetchByte(cpu);
      const lo = fetchByte(cpu);
      cpu.DPTR = (hi << 8) | lo;
      cpu.iram[0x82] = lo;
      cpu.iram[0x83] = hi;
      cycles = 2;
      break;
    }

    case 0x92: { // MOV bit, C
      const bit = fetchByte(cpu);
      writeBit(cpu, bit, cpu.CY);
      cycles = 2;
      break;
    }

    case 0x93: { // MOVC A, @A+DPTR
      cpu.A = cpu.code[(cpu.A + cpu.DPTR) & 0xFFFF];
      cycles = 2;
      break;
    }

    case 0x94: { // SUBB A, #data
      subbFromA(cpu, fetchByte(cpu));
      break;
    }

    case 0x95: { // SUBB A, direct
      const addr = fetchByte(cpu);
      subbFromA(cpu, readDirect(cpu, addr));
      break;
    }

    case 0x96: case 0x97: { // SUBB A, @Ri
      const ri = getRn(cpu, opcode & 1);
      subbFromA(cpu, readIndirect(cpu, ri));
      break;
    }

    case 0x98: case 0x99: case 0x9A: case 0x9B:
    case 0x9C: case 0x9D: case 0x9E: case 0x9F: { // SUBB A, Rn
      subbFromA(cpu, getRn(cpu, opcode & 0x07));
      break;
    }

    case 0xA0: { // ORL C, /bit
      const bit = fetchByte(cpu);
      cpu.CY = cpu.CY || !readBit(cpu, bit);
      cycles = 2;
      break;
    }

    case 0xA2: { // MOV C, bit
      const bit = fetchByte(cpu);
      cpu.CY = readBit(cpu, bit);
      break;
    }

    case 0xA3: { // INC DPTR
      cpu.DPTR = (cpu.DPTR + 1) & 0xFFFF;
      cpu.iram[0x82] = cpu.DPTR & 0xFF;
      cpu.iram[0x83] = (cpu.DPTR >> 8) & 0xFF;
      cycles = 2;
      break;
    }

    case 0xA4: { // MUL AB
      const result = cpu.A * cpu.B;
      cpu.A = result & 0xFF;
      cpu.B = (result >> 8) & 0xFF;
      cpu.CY = false;
      cpu.OV = result > 255;
      cycles = 4;
      break;
    }

    case 0xA5: // reserved
      break;

    case 0xA6: case 0xA7: { // MOV @Ri, direct
      const addr = fetchByte(cpu);
      const ri = getRn(cpu, opcode & 1);
      writeIndirect(cpu, ri, readDirect(cpu, addr));
      cycles = 2;
      break;
    }

    case 0xA8: case 0xA9: case 0xAA: case 0xAB:
    case 0xAC: case 0xAD: case 0xAE: case 0xAF: { // MOV Rn, direct
      const addr = fetchByte(cpu);
      setRn(cpu, opcode & 0x07, readDirect(cpu, addr));
      cycles = 2;
      break;
    }

    case 0xB0: { // ANL C, /bit
      const bit = fetchByte(cpu);
      cpu.CY = cpu.CY && !readBit(cpu, bit);
      cycles = 2;
      break;
    }

    case 0xB2: { // CPL bit
      const bit = fetchByte(cpu);
      writeBit(cpu, bit, !readBit(cpu, bit));
      break;
    }

    case 0xB3: // CPL C
      cpu.CY = !cpu.CY;
      break;

    case 0xB4: { // CJNE A, #data, rel
      const data = fetchByte(cpu);
      const rel = toSigned8(fetchByte(cpu));
      cpu.CY = cpu.A < data;
      if (cpu.A !== data) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0xB5: { // CJNE A, direct, rel
      const addr = fetchByte(cpu);
      const rel = toSigned8(fetchByte(cpu));
      const val = readDirect(cpu, addr);
      cpu.CY = cpu.A < val;
      if (cpu.A !== val) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0xB6: case 0xB7: { // CJNE @Ri, #data, rel
      const ri = getRn(cpu, opcode & 1);
      const data = fetchByte(cpu);
      const rel = toSigned8(fetchByte(cpu));
      const val = readIndirect(cpu, ri);
      cpu.CY = val < data;
      if (val !== data) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0xB8: case 0xB9: case 0xBA: case 0xBB:
    case 0xBC: case 0xBD: case 0xBE: case 0xBF: { // CJNE Rn, #data, rel
      const n = opcode & 0x07;
      const data = fetchByte(cpu);
      const rel = toSigned8(fetchByte(cpu));
      const rval = getRn(cpu, n);
      cpu.CY = rval < data;
      if (rval !== data) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0xC0: { // PUSH direct
      const addr = fetchByte(cpu);
      push(cpu, readDirect(cpu, addr));
      cycles = 2;
      break;
    }

    case 0xC2: { // CLR bit
      const bit = fetchByte(cpu);
      writeBit(cpu, bit, false);
      break;
    }

    case 0xC3: // CLR C
      cpu.CY = false;
      break;

    case 0xC4: { // SWAP A
      cpu.A = ((cpu.A & 0x0F) << 4) | ((cpu.A >> 4) & 0x0F);
      break;
    }

    case 0xC5: { // XCH A, direct
      const addr = fetchByte(cpu);
      const tmp = cpu.A;
      cpu.A = readDirect(cpu, addr);
      writeDirect(cpu, addr, tmp);
      break;
    }

    case 0xC6: case 0xC7: { // XCH A, @Ri
      const ri = getRn(cpu, opcode & 1);
      const tmp = cpu.A;
      cpu.A = readIndirect(cpu, ri);
      writeIndirect(cpu, ri, tmp);
      break;
    }

    case 0xC8: case 0xC9: case 0xCA: case 0xCB:
    case 0xCC: case 0xCD: case 0xCE: case 0xCF: { // XCH A, Rn
      const n = opcode & 0x07;
      const tmp = cpu.A;
      cpu.A = getRn(cpu, n);
      setRn(cpu, n, tmp);
      break;
    }

    case 0xD0: { // POP direct
      const addr = fetchByte(cpu);
      writeDirect(cpu, addr, pop(cpu));
      cycles = 2;
      break;
    }

    case 0xD2: { // SETB bit
      const bit = fetchByte(cpu);
      writeBit(cpu, bit, true);
      break;
    }

    case 0xD3: // SETB C
      cpu.CY = true;
      break;

    case 0xD4: { // DA A
      let a = cpu.A;
      let cy = cpu.CY;
      if ((a & 0x0F) > 9 || cpu.AC) {
        const t = a + 6;
        if (t > 0xFF) cy = true;
        a = t & 0xFF;
      }
      if (((a >> 4) & 0x0F) > 9 || cy) {
        const t = a + 0x60;
        if (t > 0xFF) cy = true;
        a = t & 0xFF;
      }
      cpu.A = a;
      cpu.CY = cy;
      break;
    }

    case 0xD5: { // DJNZ direct, rel
      const addr = fetchByte(cpu);
      const rel = toSigned8(fetchByte(cpu));
      let val = (readDirect(cpu, addr) - 1) & 0xFF;
      writeDirect(cpu, addr, val);
      if (val !== 0) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0xD6: case 0xD7: { // XCHD A, @Ri
      const ri = getRn(cpu, opcode & 1);
      const val = readIndirect(cpu, ri);
      const aLow = cpu.A & 0x0F;
      cpu.A = (cpu.A & 0xF0) | (val & 0x0F);
      writeIndirect(cpu, ri, (val & 0xF0) | aLow);
      break;
    }

    case 0xD8: case 0xD9: case 0xDA: case 0xDB:
    case 0xDC: case 0xDD: case 0xDE: case 0xDF: { // DJNZ Rn, rel
      const n = opcode & 0x07;
      const rel = toSigned8(fetchByte(cpu));
      let val = (getRn(cpu, n) - 1) & 0xFF;
      setRn(cpu, n, val);
      if (val !== 0) cpu.PC = (cpu.PC + rel) & 0xFFFF;
      cycles = 2;
      break;
    }

    case 0xE0: { // MOVX A, @DPTR
      cpu.A = cpu.xram[cpu.DPTR];
      cycles = 2;
      break;
    }

    case 0xE2: case 0xE3: { // MOVX A, @Ri
      const ri = getRn(cpu, opcode & 1);
      cpu.A = cpu.xram[ri];
      cycles = 2;
      break;
    }

    case 0xE4: // CLR A
      cpu.A = 0;
      break;

    case 0xE5: { // MOV A, direct
      const addr = fetchByte(cpu);
      cpu.A = readDirect(cpu, addr);
      break;
    }

    case 0xE6: case 0xE7: { // MOV A, @Ri
      const ri = getRn(cpu, opcode & 1);
      cpu.A = readIndirect(cpu, ri);
      break;
    }

    case 0xE8: case 0xE9: case 0xEA: case 0xEB:
    case 0xEC: case 0xED: case 0xEE: case 0xEF: { // MOV A, Rn
      cpu.A = getRn(cpu, opcode & 0x07);
      break;
    }

    case 0xF0: { // MOVX @DPTR, A
      cpu.xram[cpu.DPTR] = cpu.A;
      // Check if writing to SBUF address area for serial output
      cycles = 2;
      break;
    }

    case 0xF2: case 0xF3: { // MOVX @Ri, A
      const ri = getRn(cpu, opcode & 1);
      cpu.xram[ri] = cpu.A;
      cycles = 2;
      break;
    }

    case 0xF4: // CPL A
      cpu.A = (~cpu.A) & 0xFF;
      break;

    case 0xF5: { // MOV direct, A
      const addr = fetchByte(cpu);
      writeDirect(cpu, addr, cpu.A);
      // Check serial output
      if (addr === 0x99) { // SBUF
        cpu.serialOutput += String.fromCharCode(cpu.A);
      }
      break;
    }

    case 0xF6: case 0xF7: { // MOV @Ri, A
      const ri = getRn(cpu, opcode & 1);
      writeIndirect(cpu, ri, cpu.A);
      break;
    }

    case 0xF8: case 0xF9: case 0xFA: case 0xFB:
    case 0xFC: case 0xFD: case 0xFE: case 0xFF: { // MOV Rn, A
      setRn(cpu, opcode & 0x07, cpu.A);
      break;
    }

    default:
      // Unknown opcode - halt
      cpu.halted = true;
      cpu.PC = (cpu.PC - 1) & 0xFFFF;
      break;
  }

  cpu.A &= 0xFF;
  cpu.B &= 0xFF;
  syncSFRsToRAM(cpu);
  updatePSW(cpu);
  cpu.cycles += cycles;
  return cycles;
}

function addToA(cpu: CPUState, val: number): void {
  const a = cpu.A;
  const result = a + val;
  cpu.CY = result > 0xFF;
  cpu.AC = ((a & 0x0F) + (val & 0x0F)) > 0x0F;
  cpu.OV = (((a ^ val) & 0x80) === 0) && (((a ^ result) & 0x80) !== 0);
  cpu.A = result & 0xFF;
}

function addcToA(cpu: CPUState, val: number): void {
  const c = cpu.CY ? 1 : 0;
  const a = cpu.A;
  const result = a + val + c;
  cpu.CY = result > 0xFF;
  cpu.AC = ((a & 0x0F) + (val & 0x0F) + c) > 0x0F;
  cpu.OV = (((a ^ val) & 0x80) === 0) && (((a ^ result) & 0x80) !== 0);
  cpu.A = result & 0xFF;
}

function subbFromA(cpu: CPUState, val: number): void {
  const c = cpu.CY ? 1 : 0;
  const a = cpu.A;
  const result = a - val - c;
  cpu.CY = result < 0;
  cpu.AC = ((a & 0x0F) - (val & 0x0F) - c) < 0;
  cpu.OV = (((a ^ val) & 0x80) !== 0) && (((a ^ (result & 0xFF)) & 0x80) !== 0);
  cpu.A = result & 0xFF;
}
