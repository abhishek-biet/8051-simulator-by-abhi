// Pre-loaded 8051 programs

export interface SavedProgram {
  name: string;
  category: string;
  code: string;
}

export const savedPrograms: SavedProgram[] = [
  {
    name: "Block Move (Internal)",
    category: "Data Transfer",
    code: `; Block Move - Internal RAM
; Move 5 bytes from 30H to 40H
    ORG 0000H
    MOV R0, #30H    ; Source pointer
    MOV R1, #40H    ; Destination pointer
    MOV R2, #05H    ; Count
LOOP:
    MOV A, @R0
    MOV @R1, A
    INC R0
    INC R1
    DJNZ R2, LOOP
    SJMP $          ; Halt
    END`
  },
  {
    name: "Block Move (External)",
    category: "Data Transfer",
    code: `; Block Move - External RAM
; Move 5 bytes from ext 0000H to ext 0010H
    ORG 0000H
    MOV DPTR, #0000H  ; Source
    MOV R2, #05H      ; Count
    MOV R3, #00H      ; Dest high
    MOV R4, #10H      ; Dest low
LOOP:
    MOVX A, @DPTR
    INC DPTR
    PUSH 82H          ; Save DPL
    PUSH 83H          ; Save DPH
    MOV DPH, R3
    MOV DPL, R4
    MOVX @DPTR, A
    INC DPTR
    MOV R3, DPH
    MOV R4, DPL
    POP 83H
    POP 82H
    DJNZ R2, LOOP
    SJMP $
    END`
  },
  {
    name: "Block Exchange",
    category: "Data Transfer",
    code: `; Block Exchange
; Exchange 5 bytes between 30H and 40H
    ORG 0000H
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
    SJMP $
    END`
  },
  {
    name: "Multi-byte Addition",
    category: "Arithmetic",
    code: `; 16-bit Addition
; Add two 16-bit numbers
; Num1 at 30H-31H, Num2 at 32H-33H
; Result at 34H-35H
    ORG 0000H
    MOV 30H, #34H    ; Num1 Low = 34H
    MOV 31H, #12H    ; Num1 High = 12H
    MOV 32H, #CDH    ; Num2 Low = CDH
    MOV 33H, #0ABH   ; Num2 High = ABH
    
    MOV A, 30H
    ADD A, 32H
    MOV 34H, A       ; Result Low
    MOV A, 31H
    ADDC A, 33H
    MOV 35H, A       ; Result High
    SJMP $
    END`
  },
  {
    name: "8-bit Multiplication",
    category: "Arithmetic",
    code: `; 8-bit Multiplication using MUL
; Multiply A * B
    ORG 0000H
    MOV A, #25H      ; Multiplicand
    MOV B, #0AH      ; Multiplier
    MUL AB            ; Result: B(high):A(low)
    MOV 30H, A       ; Store low byte
    MOV 31H, B       ; Store high byte
    SJMP $
    END`
  },
  {
    name: "8-bit Division",
    category: "Arithmetic",
    code: `; 8-bit Division using DIV
; Divide A / B
    ORG 0000H
    MOV A, #0FFH     ; Dividend = 255
    MOV B, #0AH      ; Divisor = 10
    DIV AB            ; A = Quotient, B = Remainder
    MOV 30H, A       ; Store quotient
    MOV 31H, B       ; Store remainder
    SJMP $
    END`
  },
  {
    name: "Factorial (8-bit)",
    category: "Arithmetic",
    code: `; Factorial of a number (N!)
; Input: R0 = N, Result in A
    ORG 0000H
    MOV R0, #05H     ; Calculate 5!
    MOV A, #01H      ; Result = 1
    MOV R1, #01H     ; Counter
LOOP:
    MOV B, R1
    MUL AB
    INC R1
    CJNE R1, #06H, LOOP  ; Compare with N+1
    MOV 30H, A       ; Store result (120 = 78H)
    SJMP $
    END`
  },
  {
    name: "Sort Ascending",
    category: "Logic",
    code: `; Bubble Sort Ascending
; Sort 5 numbers at 30H-34H
    ORG 0000H
    MOV 30H, #45H
    MOV 31H, #12H
    MOV 32H, #89H
    MOV 33H, #23H
    MOV 34H, #67H
    
    MOV R3, #04H     ; Outer loop (N-1)
OUTER:
    MOV R0, #30H
    MOV R2, R3       ; Inner count
INNER:
    MOV A, @R0
    MOV R1, A
    INC R0
    MOV A, @R0
    CLR C
    SUBB A, R1
    JNC NOSWAP       ; If @R0 >= next, no swap
    MOV A, @R0       ; Swap
    DEC R0
    XCH A, @R0
    INC R0
    MOV @R0, A
NOSWAP:
    DJNZ R2, INNER
    DJNZ R3, OUTER
    SJMP $
    END`
  },
  {
    name: "Sort Descending",
    category: "Logic",
    code: `; Bubble Sort Descending
; Sort 5 numbers at 30H-34H
    ORG 0000H
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
    JNC NOSWAP       ; If @R0 >= next, no swap
    MOV A, @R0
    DEC R0
    XCH A, @R0
    INC R0
    MOV @R0, A
NOSWAP:
    DJNZ R2, INNER
    DJNZ R3, OUTER
    SJMP $
    END`
  },
  {
    name: "Find Largest",
    category: "Logic",
    code: `; Find largest number in array
; Array at 30H, count=5, result at 3FH
    ORG 0000H
    MOV 30H, #45H
    MOV 31H, #12H
    MOV 32H, #89H
    MOV 33H, #23H
    MOV 34H, #67H
    
    MOV R0, #30H
    MOV R2, #04H     ; N-1 comparisons
    MOV A, @R0        ; First element
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
    MOV 3FH, A       ; Store largest
    SJMP $
    END`
  },
  {
    name: "Find Smallest",
    category: "Logic",
    code: `; Find smallest number in array
; Array at 30H, count=5, result at 3FH
    ORG 0000H
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
    MOV 3FH, A       ; Store smallest
    SJMP $
    END`
  },
  {
    name: "Count 1s and 0s",
    category: "Logic",
    code: `; Count number of 1s and 0s in a byte
; Input at 30H, 1s count at 31H, 0s at 32H
    ORG 0000H
    MOV 30H, #0A5H   ; Test value = 10100101
    MOV R0, #08H      ; 8 bits
    MOV R1, #00H      ; 1s count
    MOV R2, #00H      ; 0s count
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
    MOV 31H, R1      ; Store 1s count
    MOV 32H, R2      ; Store 0s count
    SJMP $
    END`
  },
  {
    name: "BCD to ASCII",
    category: "Code Converter",
    code: `; BCD to ASCII Conversion
; Input BCD at 30H, ASCII result at 31H-32H
    ORG 0000H
    MOV 30H, #59H    ; BCD 59
    MOV A, 30H
    ANL A, #0F0H     ; Get upper nibble
    SWAP A
    ADD A, #30H       ; Convert to ASCII
    MOV 31H, A       ; Store tens digit
    MOV A, 30H
    ANL A, #0FH      ; Get lower nibble
    ADD A, #30H       ; Convert to ASCII
    MOV 32H, A       ; Store units digit
    SJMP $
    END`
  },
  {
    name: "Hex to Decimal",
    category: "Code Converter",
    code: `; Hex to Decimal Conversion
; Input hex at 30H, decimal result at 31H-33H
    ORG 0000H
    MOV 30H, #0FFH   ; Input = 255
    MOV A, 30H
    MOV B, #64H       ; Divide by 100
    DIV AB
    MOV 31H, A       ; Hundreds
    MOV A, B
    MOV B, #0AH       ; Divide by 10
    DIV AB
    MOV 32H, A       ; Tens
    MOV 33H, B       ; Ones
    SJMP $
    END`
  },
  {
    name: "Decimal to Hex",
    category: "Code Converter",
    code: `; Decimal to Hex Conversion
; BCD input at 30H, hex result at 31H
    ORG 0000H
    MOV 30H, #85H    ; BCD 85
    MOV A, 30H
    ANL A, #0F0H     ; Upper nibble (tens)
    SWAP A
    MOV B, #0AH
    MUL AB            ; tens * 10
    MOV R0, A
    MOV A, 30H
    ANL A, #0FH      ; Lower nibble (units)
    ADD A, R0         ; tens*10 + units
    MOV 31H, A       ; Store hex result (55H)
    SJMP $
    END`
  },
  {
    name: "Decimal UP Counter",
    category: "Counter",
    code: `; Decimal UP Counter (0-99)
; Output on P1 in BCD
    ORG 0000H
    MOV A, #00H
COUNT:
    MOV P1, A        ; Output to Port 1
    ADD A, #01H
    DA A              ; Decimal adjust
    CJNE A, #00H, COUNT  ; Loop until overflow
    SJMP $
    END`
  },
  {
    name: "Decimal DOWN Counter",
    category: "Counter",
    code: `; Decimal DOWN Counter (99-0)
; Output on P1
    ORG 0000H
    MOV A, #99H       ; Start from 99 BCD
COUNT:
    MOV P1, A
    ADD A, #99H       ; Add 99 (BCD subtract 1)
    DA A
    CJNE A, #99H, COUNT
    MOV P1, A
    SJMP $
    END`
  },
  {
    name: "Hex UP Counter",
    category: "Counter",
    code: `; Hex UP Counter (00-FF)
; Output on P1
    ORG 0000H
    MOV A, #00H
COUNT:
    MOV P1, A
    INC A
    CJNE A, #00H, COUNT
    SJMP $
    END`
  },
  {
    name: "Hex DOWN Counter",
    category: "Counter",
    code: `; Hex DOWN Counter (FF-00)
; Output on P1
    ORG 0000H
    MOV A, #0FFH
COUNT:
    MOV P1, A
    DEC A
    CJNE A, #0FFH, COUNT
    SJMP $
    END`
  },
  {
    name: "LED Pattern on P1",
    category: "Peripherals",
    code: `; Toggle LED pattern on Port 1
    ORG 0000H
    MOV A, #0AAH     ; 10101010
LOOP:
    MOV P1, A
    CPL A             ; Complement pattern
    SJMP LOOP
    END`
  },
  {
    name: "Serial Output",
    category: "Peripherals",
    code: `; Send 'Hello' via Serial (SBUF)
    ORG 0000H
    MOV A, #48H       ; 'H'
    MOV SBUF, A
    MOV A, #65H       ; 'e'
    MOV SBUF, A
    MOV A, #6CH       ; 'l'
    MOV SBUF, A
    MOV A, #6CH       ; 'l'
    MOV SBUF, A
    MOV A, #6FH       ; 'o'
    MOV SBUF, A
    SJMP $
    END`
  },
];
