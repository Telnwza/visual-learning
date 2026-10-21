# Phase 9 — Button Input, ALU, editable FSM and MM:SS timer

Four new modules compose the earlier foundations. Their editable VHDL and individual Studio packages live together in [compositions/](compositions/). [Download the Phase 9 ZIP](downloads/phase9-modules.zip), including every source/package required by its examples. Physical display drivers remain separate.

## Choose one import path

| Your project | Import |
|---|---|
| New project | [Complete composition pack](packs/compositions.sccomp.json): four new modules plus ten required foundation modules, 14 definitions total |
| Already contains the ten foundations below | [Existing-project add-on](compositions/existing-project.sccomp.json): installs only the four new definitions; preserves existing dependencies |
| Need one block in a new project | Its individual `.sccomp.json`: includes that block's dependency closure |
| Prefer raw VHDL | Import its root and dependency `.vhd` files together, or import only its root if dependencies are already installed; explicitly wire inputs without package-only defaults |

Use **Tools → Import Component Package…** for packages, then place from REUSABLE CIRCUITS and configure each box. Choose a complete pack **or** its individual files; repeated definitions are rejected atomically. Importing a full pack over already installed foundations is also rejected. The add-on supplies the practical existing-project path without overwriting them.

The ten foundation definitions are `ss_input_sync`, `ss_input_debounce`, `ss_input_edge`, `ss_add_sub`, `ss_multiply`, `ss_divide`, `ss_bitwise`, `ss_tick`, `ss_counter`, `ss_bin_to_bcd`. If some are missing, import their individual packages first, then the add-on. Component packages may now resolve VHDL entity dependencies already installed in the destination. Ordinary project imports remain self-contained; dependency/source changes are not silently merged or replaced. Compatible user changes to an existing dependency are retained; compile/simulate the composition after modifying its interfaces or behavior.

The ZIP has 21 distinct module source/package pairs: four new compositions, ten foundations and seven example dependencies. It also includes the complete/add-on packs, editable FSM template, three examples and guides. Existing Phase 6/7/8 ZIPs retain their historical documentation snapshots.

## Button Input

`ss_button_input` wires SYNC → DEBOUNCE → EDGE with one continuously running rising-edge clk and synchronous active-high rst.

| Generic | Range / default |
|---|---|
| STAGES | 2–64 / 2 |
| STABLE_CYCLES | 1–2147483647 / 500000 |
| CLOCK_HZ | 1–2147483647 / 50000000; conversion metadata, not a generated clock |
| ACTIVE_LOW | 0 active-high, 1 active-low / 0 |
| MODE | 0 press, 1 release, 2 both / 0 |

Inputs: clk, rst, raw one-bit d. Outputs: q (1 means pressed), pressed, released and pulse selected by MODE. Both individual events are always available, irrespective of MODE. pressed/released/pulse last one clock and occur **one clock after** debounced q changes. With stable raw data immediately after reset, an event arrives after STAGES + STABLE_CYCLES + 1 sampling edges. Bounce restarts the required stability interval. A held active button through reset is reported only after passing the sampling/stability chain, not immediately.

The synchronizer resets to the physical inactive level selected by ACTIVE_LOW; this avoids interpreting active-low idle as a press. Use the Inspector or preplacement **ตั้งระยะนิ่ง (ms)** helper. Default 500000 clocks is 10 ms at 50 MHz. Digital tests do not model metastability or prove a particular switch's bounce duration. This input is for one-bit levels, not asynchronous multibit bus transfers.

Package default: rst=0. Always connect clk and d. For controls in the remaining modules use `pressed` (or another selected event) as a one-clock command; do not feed raw buttons directly to their command pins.

## ALU

`ss_alu` has WIDTH 1–64 (default 8) and SIGNED_MODE 0 unsigned / 1 two's-complement (default 0). clk/rst/en/start use a rising-edge shared clock and synchronous active-high reset. a, b and outputs y/result_hi have WIDTH bits; opcode has three bits, cin has one.

| Opcode | Operation | y | result_hi | Operation-specific flags |
|---|---|---|---|---|
| 000 | a+b+cin | Low WIDTH bits | 0 | carry; signed overflow |
| 001 | a−b−cin | Low WIDTH bits | 0 | borrow; signed overflow |
| 010 | a×b | Low product half | High product half | overflow if the full product cannot fit in WIDTH bits |
| 011 | a÷b | Quotient | Remainder | divide_by_zero; signed minimum/−1 overflow |
| 100 | AND | a AND b | 0 | zero/negative |
| 101 | OR | a OR b | 0 | zero/negative |
| 110 | XOR | a XOR b | 0 | zero/negative |
| 111 | NOT | NOT a | 0 | zero/negative |

At enabled idle start, fast operations capture their result and pulse done on that edge; busy remains zero. Their valid is sticky until another request or reset, including when arithmetic overflow is flagged. cin is used only for addition/subtraction and denotes carry-in/borrow-in respectively. Carry/borrow describe unsigned bit arithmetic even in signed mode.

Division captures operands at the request edge, sets busy and clears valid. With continuously enabled progress it completes after **WIDTH+2 subsequent clock edges**. Divide-by-zero or signed minimum/−1 errors complete after two subsequent edges with valid=0. Divide-by-zero returns y=0 and result_hi=a; minimum/−1 returns the wrapped minimum and remainder zero. Signed quotient truncates toward zero; remainder has the dividend's sign.

Changing opcode/a/b during busy cannot alter the captured division. Busy starts are ignored, including the completion edge. en=0 rejects idle starts and pauses division iterations; it does not discard an already completed child result, so done may still pulse on the completion handoff edge while en=0. rst aborts and clears results/status. A held start repeats once idle again: use event pulses for one transaction.

zero/negative describe y for add/sub/divide/logic. For multiplication they describe the **full 2×WIDTH-bit product**, following the existing multiplier; y alone can be zero while result_hi is nonzero. negative is always zero in unsigned mode. Outputs keep the last completed result during busy; interpret status together with busy/valid/error flags. invalid_op reports an unknown/X opcode in digital simulation; all eight binary opcodes are implemented. Inputs should be stable binary signals at the acceptance edge.

Package defaults: rst=0, en=1, start=0, cin=0. Connect clk, opcode, a and b. The ALU reuses existing add/sub, multiplier, iterative divider and bitwise entities. Shifts/rotates and other comparisons remain separate configurable foundation modules.

Example: [64-bit signed ALU wiring](examples/phase9-alu.schtxt). Import its individual package or a composition pack; set opcode and pulse start. −7 ÷ 3 yields −2 with remainder −1. Wider multiplication preserves its complete result across two buses of at most 64 bits each.

## Editable FSM template

[ss_fsm_template.sch.txt](compositions/ss_fsm_template.sch.txt) imports as an inspectable gate circuit with two enabled D flip-flops, equality decodes, next-state gates and a two-bit state bus. It uses only native parts, so no custom dependency is needed. Import via **Tools → Import Schematic Text…** and choose it as top in the Inspector when testing/exporting.

| Current state | Enabled event | Next state |
|---|---|---|
| IDLE = 00 | start | ACTIVE = 01 |
| ACTIVE = 01 | finish | DONE = 10 |
| DONE = 10 | start | ACTIVE = 01 |
| Any valid state | cancel | IDLE = 00; cancel wins |
| Any valid state | en=0 | Hold, including when cancel is asserted |
| Invalid = 11 | Next rising edge | IDLE, even with en=0 |
| Any state | rst=1 at rising edge | IDLE, even with en=0 |

ACTIVE ignores start; IDLE/DONE ignore finish. When start and finish coincide, the current state determines which applies: IDLE/DONE start, ACTIVE finishes. Outputs state[1:0], active, done and invalid are decoded levels. **done is a level in DONE**, not a one-clock transaction event; use the Edge Detector if an event is required. Reset is synchronous through next-state logic, not an asynchronous reset pin, and every flip-flop shares the unchanged clk.

To customize the FSM, edit state constants, transition gates and output decodes in Studio. Keep a defined recovery for unused encodings and explicitly extend the state bus/storage if adding states. Re-run Check and a behavioral test for the edited transitions.

`ss_fsm_template.vhd` is exported from that actual template and wrapped by its individual package for convenient box placement; it is not a separate hand-maintained implementation. After changing the template, generate the top VHDL again and update/re-export the module package using the existing source replacement preview. Import the schematic template and its opaque VHDL box in separate projects, or rename the template sheet before export, to avoid duplicate entity names.

Package defaults: rst=0, en=1, start/finish/cancel=0; clk is required. To drive a mode circuit, connect conditioned press pulses to start/cancel and the operation's completion event to finish.

## MM:SS timer

`ss_mmss_timer` combines Tick, bounded minute/second counters and BIN→BCD. MAX_MINUTES is 0–99 (default 99). TICKS_PER_SECOND is 1–2147483647 (default 50000000 for the user's 50 MHz clock). All logic uses a shared rising-edge clock and synchronous active-high rst; no timer clock is AND-gated or generated.

Inputs: clk, rst, en, start, pause, load, down, load_minutes[6:0], load_seconds[5:0]. Outputs: minutes[6:0], seconds[5:0], digits[15:0], running, terminal, done, valid and load_error.

- rst clears to 00:00 and stops, in either direction.
- load sets a valid time and stops. Minutes must be ≤MAX_MINUTES and seconds ≤59; invalid load holds the old time, stops and pulses load_error. Values are rejected, not clamped.
- start begins/resumes. At the selected endpoint it pulses done without moving the time. pause stops and retains the time. Commands act independently of en.
- down=0 counts up, carrying 00:59→01:00 and stopping at MAX_MINUTES:59. down=1 borrows 01:00→00:59 and stops at 00:00. Arrival stops running and pulses done once, preventing wrap.
- rst > load > pause > start > terminal/tick. A pause or load coinciding with a scheduled count prevents that count. Hold commands only if repeated actions are intended; normally use one-clock events.
- Reset, load, start, pause and en=0 clear fractional timing. Resume/reenable therefore waits TICKS_PER_SECOND clocks plus **one pipeline clock** before changing the displayed time. Subsequent steps are TICKS_PER_SECOND clocks apart. Pausing does not retain a partial second. en=0 retains the time/running intent while resetting the fractional divider; it is not the same as the pause command, which clears running.
- Changing down while running selects direction/endpoint at the next sampling edge; keep it synchronous and stable around that edge. If the new direction makes the current time terminal, the next edge stops and reports done without counting.

valid means the stored time/BCD is representable; load_error reports a rejected load. terminal is a level determined by direction, independent of running. done is a one-clock event; it is not a sticky alarm. digits packs `[minute tens, minute ones, second tens, second ones]` from most to least significant nibble. For 12:34 the bus is 0x1234. Separate BIN outputs are also provided for other calculations.

Package defaults: rst=0, en=1, start/pause/load/down=0 and load data=0. Connect clk and desired command pulses. Display rendering and button sampling do not need to stop when the timer pauses.

Examples:

- [Two buttons → MM:SS → seven-segment](examples/phase9-button-timer.schtxt): press start/pause after loading a time. Default buttons are active-high; configure both ACTIVE_LOW values for your switch wiring. The dot on common 2 displays MM.SS; a dedicated physical colon pin is not assumed. Set scanner polarity to your existing board conventions.
- [MM:SS → formatter → LCD](examples/phase9-mmss-lcd.schtxt): always refreshes the LCD while timer en controls counting. The overlay replaces the formatter's decimal separator with a literal colon; load 12 minutes/34 seconds to display `12:34` on row 1. LCD timings remain the conservative defaults from Phase 8.

Both examples need the four compositions plus the individually supplied example dependencies: `ss_bus_zero_extend`, `ss_sevenseg_digits`, `ss_sevenseg_scan`, `ss_number_formatter`, `ss_text_overlay`, `ss_lcd16x2` and its `ss_lcd_write` dependency. All seven source/package pairs are in the ZIP. For packages, import the first five individual files plus the LCD16×2 individual package (which already contains its writer), then import the example text. Do not also import the writer separately.

## Verification and limits

Tests use the real Studio parser/importer/exporter for independent/raw packages and dependency closures, add-on preservation/atomic rejection, generics, clock checks, Undo/reopen/source updates and exact FSM-template export. GHDL checks exercise command precedence, button latency/bounce, 1/8/64-bit ALU values/flags/division capture/pause/error latency, legal FSM events/invalid recovery, timer rollover/borrow/load/pause/reset/endpoint, and all three composed examples. Boundary timing counts and all four module families are synthesized; maximum billion-clock intervals are not simulated.

Browser verification uses actual UI import, top selection, Check and VHDL generation. Its actual generated output is compiled/synthesized with GHDL. This is local digital evidence; no Vivado timing/bitstream build, board programming or physical button/LCD/ADC verification is implied. Earlier supplied lab files and module source files remain unchanged.
