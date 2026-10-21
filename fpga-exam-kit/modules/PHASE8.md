# Phase 8 — Seven-segment, LCD 16×2 and accepted lab ADC

Eight external modules are supplied as editable VHDL and Studio component packages. They are not installed automatically. Import a category pack or individual packages from [seven-segment/](seven-segment/), [lcd/](lcd/) and [adc/](adc/). Each instance has its own generic settings; configure it before placement or in the Inspector.

| Module | Purpose | Configuration / important inputs |
|---|---|---|
| `ss_sevenseg_decode` | One decimal, HEX or raw digit | MODE 0/1/2; ACTIVE_LOW 0/1; digit, raw, blank, dot |
| `ss_sevenseg_digits` | Pack patterns for independently masked digits | DIGITS 1–16; HEX_MODE 0/1; digits_in[64], blank, dot |
| `ss_sevenseg_scan` | Multiplex an arbitrary pattern frame | DIGITS 1–16; SLOT_CYCLES ≥3; independent segment/common polarity; clk/rst/en |
| `ss_lcd_write` | One captured parallel 8-bit LCD transaction | SETUP/HIGH/HOLD_CYCLES; start, byte_in, rs_in |
| `ss_lcd16x2` | Initialize and refresh every LCD cell | Four 64-bit text buses; en/update; startup/byte timing; AUTO_REFRESH |
| `ss_text_overlay` | Put a dynamic field anywhere in a text frame | Four base/field buses; offset[5], length[5], en, field_valid |
| `ss_adc_sample_valid` | Capture and flag a completed accepted-lab sample | WIDTH 1–64; clk, clear_valid, cs, sample_in |
| `ss_spi_adc_lab` | ADC-only export of the supplied working schematic | Fixed original protocol and 12-bit output; clk, dout_miso, clear_valid |

[Download the Phase 8 bundle](downloads/phase8-modules.zip). For examples using the Phase 7 converter/formatter, their exact dependencies are also included in this ZIP under `conversion/` and `formatting/`.

## Import choices

**Component packages:** Tools → Import Component Package… provides descriptions, friendly choices and safe explicit defaults. The LCD16×2 individual package already contains its `ss_lcd_write` dependency: import that package alone, or import the LCD category pack. Do not import the writer individually afterward into the same project; a duplicate entity is rejected. Other individual packages each contain one module.

**Raw VHDL:** Tools → Import VHDL Module… accepts the sources directly. Select `ss_lcd_write.vhd` and `ss_lcd16x2.vhd` together for the controller, or import the writer first and paste the controller next. Raw files have no package-only unused-input defaults: connect every required input explicitly. All other Phase 8 sources are self-contained.

Saving the project embeds the sources. Disk edits do not automatically alter packages or saved projects. Use the existing Change source preview to update a module and Export package to save its revised package.

## Seven-segment wiring and numeric formats

Canonical patterns are active high, bit 0=A, 1=B, …, 6=G; bit 7 is the dot. Physical pin ordering and polarity must match your existing board constraints.

- Decoder MODE=0 accepts 0–9; 10–15 blanks and clears valid. MODE=1 accepts 0–F. MODE=2 passes raw[6:0]. `blank=1` blanks segments and dot and clears valid. ACTIVE_LOW affects both outputs. Feed stable binary inputs.
- Packer nibble `i` is `digits_in(4*i+3 downto 4*i)`, starting at the least significant digit. `blank(i)` and `dot(i)` are independent masks. Output byte i drives common i. Bytes 0–7 are in patterns_lo, 8–15 in patterns_hi; unused bytes are zero. Invalid decimal nibbles blank only that cell. Its outputs are always canonical active high.
- Scanner consumes these pattern buses, so custom letters, independent digits and mixed decimal/HEX/raw patterns can be assembled with decoders/CONST and bus utilities. Apply polarity only in the scanner.
- `rst=1` synchronously restarts; `en=0` blanks the display immediately and resets scanning on the next edge. Re-enabling starts at digit 0 with a fresh frame. It does not pause halfway through a slot.
- Each slot lasts SLOT_CYCLES main-clock edges. At its boundary all commons turn off while the old pattern remains. The next edge loads the new pattern while commons stay off; the following edge enables the selected common. This leaves **two blank clock intervals per slot**, including at frame wrap. Frames are sampled only at startup and wrap, avoiding mixed frames when inputs change.
- slot_tick and frame_tick last one clock. Both pulse on startup; thereafter frame_tick marks common-0 slot boundaries. index[3:0] identifies the selected slot, including blank intervals.

At clock frequency F, each digit repeats at `F / (DIGITS × SLOT_CYCLES)`. Active fraction within a slot is `(SLOT_CYCLES−2)/SLOT_CYCLES`; each digit's total duty fraction additionally divides by DIGITS. Default 50 MHz / 4 digits / 50,000 clocks gives 250 complete frames/second. Every scanner uses the continuously running main clock, not a gated/generated scan clock.

Decimal BIN values must pass through `ss_bin_to_bcd`; a binary nibble splitter displays HEX. This scanner supplies up to 16 cells. Phase 7 still supports up to 20 decimal digits; showing all 20 requires separate display groups or LCD text. A four-digit decimal display must handle its converter's overflow above 9999 explicitly.

Example: [BIN → BCD → four-digit display](examples/phase8-sevenseg.schtxt). Import `ss_bin_to_bcd.sccomp.json`, `ss_sevenseg_digits.sccomp.json`, `ss_sevenseg_scan.sccomp.json` first. Decimal 1234 maps common 0 to digit 4, then 3, 2, 1. Set polarity on the scan box to match your existing hardware.

## LCD text packing and placement

The interface follows the supplied lab's parallel **data[7:0], E and RS** method. RW is driven low for write-only operation; no busy-flag read or I²C adapter is used. Use the existing LCD pin mapping. Text buses hold character codes, not binary numbers or BCD directly.

| Input | Cells | Byte order |
|---|---|---|
| text_0[63:0] | Row 1, columns 0–7 | Cell 0 is bits 7:0, cell 7 is bits 63:56 |
| text_1[63:0] | Row 1, columns 8–15 | Cell 8 is bits 7:0 |
| text_2[63:0] | Row 2, columns 0–7 | Cell 16 is bits 7:0 |
| text_3[63:0] | Row 2, columns 8–15 | Cell 24 is bits 7:0 |

Pad empty cells with `0x20` (space), not zero. For example, text_0 CONST `20203A45554C4156` displays `VALUE:  `; all-space CONST is `2020202020202020`. ASCII-compatible characters are supported; Thai text is not automatically encoded/rendered by the LCD character ROM. Custom character codes can be placed as bytes, but CGRAM programming is outside this controller.

To show a number anywhere: BIN→BCD→Number Formatter→Text Overlay→LCD. Connect the formatter's four text buses to field_0…3, length to length and valid to field_valid. Provide base text, select offset (0=row 1 column 0; 16=row 2 column 0) and connect the overlay's four outputs to the LCD. Change the formatter's digit count, HEX/sign/decimal-point settings independently.

Overlay replaces length 0–31 bytes, clipping past cell 31 and setting clipped=1. Invalid fields pass the base through with valid=0; disable passes the base with valid=1. A zero-length field changes nothing. Direct LCD inputs can set all 32 cells.

Example: [Label on row 1, decimal value on row 2](examples/phase8-number-lcd.schtxt). Import individual BIN→BCD and Number Formatter packages plus `packs/lcd.sccomp.json`. Set value=12345: row 1 reads `VALUE:` and row 2 reads `12345`.

## LCD transactions and timing

Both LCD blocks require a continuous rising-edge clock and synchronous active-high rst. Timing settings are **clock counts**, not Hz or milliseconds. Default counts are chosen for the user's 50 MHz clock. Changing the input frequency requires recalculating them.

`ss_lcd_write` accepts start only when idle and captures byte_in/rs_in. It holds both through SETUP cycles with E low, HIGH cycles with E high, then HOLD cycles with E low. busy-start is ignored, including the completion edge; done pulses on completion. A held start triggers another transaction when idle. Reset can abort a transaction; normal enables should not interrupt E.

`ss_lcd16x2` initializes even with en=0. It first sends three `0x30` function-set bytes, then the lab's `38,0C,06,01` commands. It waits POWERUP_CYCLES before starting, INIT_WAIT_CYCLES after initialization commands and CLEAR_WAIT_CYCLES after clear. ready stays high after initialization. busy includes initialization and active frame writes.

Default startup wait is 2,500,000 clocks (50 ms), inter-command wait 250,000 (5 ms), clear wait 100,000 (2 ms), and STEP_CYCLES=50,000 (1 ms for each byte's setup/high/hold phase). Defaults are deliberately slow, matching the lab's millisecond-scale byte timing. The extra startup function sets and wait choices follow the [original Hitachi HD44780U datasheet](https://cdn-shop.adafruit.com/datasheets/HD44780.pdf), especially Initialization by Instruction and AC timing. Small counts used in simulation are **not hardware timing recommendations**. Reducing them requires meeting E/data timing and instruction execution time for the actual controller; this implementation does not read its busy flag.

At idle, en=1 and either AUTO_REFRESH=1 or update=1 starts a frame snapshot. It writes address 0x80 + 16 characters, then 0xC0 + 16 characters. Inputs may change afterward without tearing the current frame. en=0 prevents the next frame but lets an active transaction/frame finish. update while busy is ignored, not queued; keep update asserted until an idle edge or use AUTO_REFRESH for continuously changing values. done pulses after the last cell completes. rst restarts initialization. Text snapshots are initial-frame-only, not simultaneous physical updates of all cells.

## ADC reuse, completion and provenance

`ss_spi_adc_lab.vhd` is the ADC-only structural export from project `prj16233`, sheet `sch19760` (`adc`) in the supplied `20261008193355lab7countdowntimer.schproj.json`. The display branch is excluded; all connecting junctions are retained. Its divider, frame counter, comparisons, falling-edge MOSI flip-flop, serial shift register and output register are exported unchanged in logic. Sub-sheet boundaries are flattened into one importable VHDL entity. The Studio export reported **zero fallback outputs**. [provenance.json](adc/provenance.json) records the original file checksum and extraction details. The original file was not changed.

The source has the existing fixed command, channel convention, derived SCK timing and 12-bit sample; these are not replaced with a guessed ADC model or a new configurable SPI protocol. No new pin map is supplied.

- clk: original 50 MHz lab clock; dout_miso: original FPGA input.
- sck, din_mosi, cs: original output signals and polarities.
- sample_raw[11:0]: the original output register's latched sample.
- sample_valid: one main-clock pulse after the original CS-high completion slot ends and CS becomes low.
- valid: sticky flag indicating a sample has completed since the last clear.
- clear_valid: synchronous clear of **added event flags only**. It never resets, pauses or gates the original ADC circuit; sample_raw retains the original core's value.

`ss_adc_sample_valid` is separately available when reusing the original schematic block. Supply the same-domain CS and its already-latched output sample. It arms on CS=1, then captures once on CS=0. Startup CS=0 produces no false event. sample_valid lasts one clock, valid is sticky, and clear_valid clears this adapter's captured sample and flags. This completion convention is specific to the accepted lab: it is not a generic monitor for arbitrary SPI peripherals, asynchronous CS or independently clocked data.

[ADC → BCD → four-digit display example](examples/phase8-adc-sevenseg.schtxt) includes a raw 12-bit monitor output and sample/valid flags. Import the ADC pack, individual BIN→BCD package and seven-segment pack. For an LCD, connect sample_raw to the number-LCD example's converter (change WIDTH to 12) and use continuous refresh; gate display_en with valid if the display should stay blank until its first sample. Do not gate the ADC clock.

## Local verification

Focused tests cover independent/raw imports and LCD dependency closure, Undo/persistence, bounded controls and clock diagnostics; GHDL checks cover decoder tables/polarities, pattern packing, scanner transitions/snapshots, LCD byte timing and 32-cell frame order, overlays, and new ADC event logic. GHDL synthesis checks cover all eight modules and the ADC/display composition. The accepted ADC lab internals were **not functionally re-audited or simulated**.

Browser smoke verification imports raw packer/scanner sources, creates a wired schematic, selects its top entity, runs Studio Check and Generate VHDL. That actual browser-generated bundle was compiled and synthesized with GHDL. No browser console errors/warnings were recorded.

No Vivado timing/bitstream build, GPIO timing measurement or physical EDGE board/LCD/ADC test was performed. Use the existing working constraints and hardware wiring, and keep default LCD timing for initial board use.
