// Pre-loaded 8051 programs

export interface SavedProgram {
  name: string;
  category: string;
  code: string;
}

export const NEW_PROGRAM_TEMPLATE = `    ORG 0000H

    sjmp start

    org 30h

start:

here: sjmp here

    end`;

export const savedPrograms: SavedProgram[] = [
  {
    name: "Block Move (Internal)",
    category: "Data Transfer",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV R0, #30H
    MOV R1, #40H
    MOV R2, #05H
LOOP:
    MOV A, @R0
    MOV @R1, A
    INC R0
    INC R1
    DJNZ R2, LOOP

here: sjmp here

    end`
  },
  {
    name: "Block Move (External)",
    category: "Data Transfer",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV DPTR, #0000H
    MOV R2, #05H
    MOV R3, #00H
    MOV R4, #10H
LOOP:
    MOVX A, @DPTR
    INC DPTR
    PUSH 82H
    PUSH 83H
    MOV DPH, R3
    MOV DPL, R4
    MOVX @DPTR, A
    INC DPTR
    MOV R3, DPH
    MOV R4, DPL
    POP 83H
    POP 82H
    DJNZ R2, LOOP

here: sjmp here

    end`
  },
  {
    name: "Block Exchange",
    category: "Data Transfer",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV R0, #30H
    MOV R1, #40H
    MOV R2, #05H
LOOP:
    MOV A, @R0
    XCH A, @R1
    MOV @R0, A
    INC R0
    INC R1
    DJNZ R2, LOOP

here: sjmp here

    end`
  },
  {
    name: "Multi-byte Addition",
    category: "Arithmetic",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV 30H, #34H
    MOV 31H, #12H
    MOV 32H, #0CDH
    MOV 33H, #0ABH

    MOV A, 30H
    ADD A, 32H
    MOV 34H, A
    MOV A, 31H
    ADDC A, 33H
    MOV 35H, A

here: sjmp here

    end`
  },
  {
    name: "8-bit Multiplication",
    category: "Arithmetic",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV A, #25H
    MOV B, #0AH
    MUL AB
    MOV R0, A
    MOV R1, B

here: sjmp here

    end`
  },
  {
    name: "8-bit Division",
    category: "Arithmetic",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV A, #0FFH
    MOV B, #0AH
    DIV AB
    MOV R0, A
    MOV R1, B

here: sjmp here

    end`
  },
  {
    name: "Factorial (8-bit)",
    category: "Arithmetic",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV R0, #05H
    MOV A, #01H
    MOV R1, #01H
LOOP:
    MOV B, R1
    MUL AB
    INC R1
    CJNE R1, #06H, LOOP
    MOV 30H, A

here: sjmp here

    end`
  },
  {
    name: "Sort Ascending",
    category: "Logic",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV 30H, #45H
    MOV 31H, #12H
    MOV 32H, #89H
    MOV 33H, #23H
    MOV 34H, #67H

    MOV R3, #04H
OUTER:
    MOV R0, #30H
    MOV R2, R3
INNER:
    MOV A, @R0
    MOV R1, A
    INC R0
    MOV A, @R0
    CLR C
    SUBB A, R1
    JNC NOSWAP
    MOV A, @R0
    DEC R0
    XCH A, @R0
    INC R0
    MOV @R0, A
NOSWAP:
    DJNZ R2, INNER
    DJNZ R3, OUTER

here: sjmp here

    end`
  },
  {
    name: "Sort Descending",
    category: "Logic",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV 30H, #45H
    MOV 31H, #12H
    MOV 32H, #89H
    MOV 33H, #23H
    MOV 34H, #67H

    MOV R3, #04H
OUTER:
    MOV R0, #30H
    MOV R2, R3
INNER:
    MOV A, @R0
    MOV R1, A
    INC R0
    MOV A, @R0
    CLR C
    MOV B, A
    MOV A, R1
    SUBB A, B
    JNC NOSWAP
    MOV A, @R0
    DEC R0
    XCH A, @R0
    INC R0
    MOV @R0, A
NOSWAP:
    DJNZ R2, INNER
    DJNZ R3, OUTER

here: sjmp here

    end`
  },
  {
    name: "Find Largest",
    category: "Logic",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV 30H, #45H
    MOV 31H, #12H
    MOV 32H, #89H
    MOV 33H, #23H
    MOV 34H, #67H

    MOV R0, #30H
    MOV R2, #04H
    MOV A, @R0
LOOP:
    INC R0
    MOV R1, A
    CLR C
    SUBB A, @R0
    MOV A, R1
    JNC SKIP
    MOV A, @R0
SKIP:
    DJNZ R2, LOOP
    MOV 3FH, A

here: sjmp here

    end`
  },
  {
    name: "Find Smallest",
    category: "Logic",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV 30H, #45H
    MOV 31H, #0CH
    MOV 32H, #89H
    MOV 33H, #23H
    MOV 34H, #67H

    MOV R0, #30H
    MOV R2, #04H
    MOV A, @R0
LOOP:
    INC R0
    MOV R1, A
    CLR C
    SUBB A, @R0
    MOV A, R1
    JC SKIP
    MOV A, @R0
SKIP:
    DJNZ R2, LOOP
    MOV 3FH, A

here: sjmp here

    end`
  },
  {
    name: "Count 1s and 0s",
    category: "Logic",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV 30H, #0A5H
    MOV R0, #08H
    MOV R1, #00H
    MOV R2, #00H
    MOV A, 30H
LOOP:
    RRC A
    JNC ZERO
    INC R1
    SJMP NEXT
ZERO:
    INC R2
NEXT:
    DJNZ R0, LOOP
    MOV 31H, R1
    MOV 32H, R2

here: sjmp here

    end`
  },
  {
    name: "BCD to ASCII",
    category: "Code Converter",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV 30H, #59H
    MOV A, 30H
    ANL A, #0F0H
    SWAP A
    ADD A, #30H
    MOV 31H, A
    MOV A, 30H
    ANL A, #0FH
    ADD A, #30H
    MOV 32H, A

here: sjmp here

    end`
  },
  {
    name: "Hex to Decimal",
    category: "Code Converter",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV 30H, #0FFH
    MOV A, 30H
    MOV B, #64H
    DIV AB
    MOV 31H, A
    MOV A, B
    MOV B, #0AH
    DIV AB
    MOV 32H, A
    MOV 33H, B

here: sjmp here

    end`
  },
  {
    name: "Decimal to Hex",
    category: "Code Converter",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV 30H, #85H
    MOV A, 30H
    ANL A, #0F0H
    SWAP A
    MOV B, #0AH
    MUL AB
    MOV R0, A
    MOV A, 30H
    ANL A, #0FH
    ADD A, R0
    MOV 31H, A

here: sjmp here

    end`
  },
  {
    name: "Decimal UP Counter",
    category: "Counter",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV A, #00H
COUNT:
    MOV P1, A
    ADD A, #01H
    DA A
    CJNE A, #00H, COUNT

here: sjmp here

    end`
  },
  {
    name: "Decimal DOWN Counter",
    category: "Counter",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV A, #99H
COUNT:
    MOV P1, A
    ADD A, #99H
    DA A
    CJNE A, #99H, COUNT
    MOV P1, A

here: sjmp here

    end`
  },
  {
    name: "Hex UP Counter",
    category: "Counter",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV A, #00H
COUNT:
    MOV P1, A
    INC A
    CJNE A, #00H, COUNT

here: sjmp here

    end`
  },
  {
    name: "Hex DOWN Counter",
    category: "Counter",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV A, #0FFH
COUNT:
    MOV P1, A
    DEC A
    CJNE A, #0FFH, COUNT

here: sjmp here

    end`
  },
  {
    name: "LED Pattern on P1",
    category: "Peripherals",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV A, #0AAH
LOOP:
    MOV P1, A
    CPL A
    SJMP LOOP

    end`
  },
  {
    name: "Serial Output",
    category: "Peripherals",
    code: `    ORG 0000H

    sjmp start

    org 30h

start:
    MOV A, #48H
    MOV SBUF, A
    MOV A, #65H
    MOV SBUF, A
    MOV A, #6CH
    MOV SBUF, A
    MOV A, #6CH
    MOV SBUF, A
    MOV A, #6FH
    MOV SBUF, A

here: sjmp here

    end`
  },
];
