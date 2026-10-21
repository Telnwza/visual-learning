# Phase 7: arithmetic, comparisons, encoding and number formatting

Sixteen external modules are supplied in `arithmetic/` (7), `comparison/` (4), `encoding/` (1), `conversion/` (2) and `formatting/` (2). Each `.vhd` has an exact matching individual `.sccomp.json`. Category packs are in `packs/`; import a category pack **or** its individual files through **Tools → Import Component Package…**. Do not import the same entity twice. Per-instance generic settings remain independent; sources are shared by instances of the same definition.

Download all Phase 7 sources, individual packages, five category packs and two examples: [phase7-modules.zip](downloads/phase7-modules.zip). The complete library index is [README.md](README.md).

Raw VHDL imports are also supported. They have no Studio notes/defaults; wire every input explicitly. The package defaults are: add/sub cin=0; divider rst=0/en=1/start=0; encoder en=1; BCD→BIN bcd_hi=0/negative=0; formatter digits_hi=0/negative=0/input_valid=1. All other inputs require a connection.

## Width and timing conventions

WIDTH is 1–64 wherever present. Arithmetic bit patterns use two's complement when SIGNED_MODE=1 and unsigned interpretation otherwise. Combinational modules have **no clock or handshake**: their outputs settle after their inputs change. Digital delta cycles are not FPGA propagation timing. Register results if a physical downstream interface needs stable values; evaluate actual timing/resource use with Vivado.

The full multiply result uses two WIDTH-bit pins. A 64×64 product therefore preserves all 128 bits without extending Studio's 64-bit-per-pin contract. Converters always use bcd_lo[64] (digits 0–15) and bcd_hi[16] (digits 16–19), enough for all twenty digits of the unsigned 64-bit maximum. Digit zero is the least significant nibble, bits 3:0. These split buses must be kept together for the full result.

## Arithmetic

| Entity | Configuration and outputs |
|---|---|
| ss_add_sub | SUBTRACT=0: a+b+cin; SUBTRACT=1: a−b−cin. y is the low WIDTH bits. carry is unsigned addition carry; borrow is unsigned subtraction borrow. overflow detects signed range loss only in SIGNED_MODE=1. zero tests y; negative tests y's sign in signed mode. |
| ss_multiply | Full product = result_hi & result_lo. Signed product is a 2×WIDTH two's-complement number. overflow indicates that the **full** result does not fit a single WIDTH-bit result; it does not indicate lost product bits. zero/negative refer to the full product, negative=0 in unsigned mode. |
| ss_divide | Iterative division with clk/rst/en/start, quotient/remainder, busy/done/valid, divide_by_zero/overflow/zero/negative. See timing below. |
| ss_unary | OPERATION=0 negate, 1 absolute value. Signed minimum retains its bit pattern and sets overflow for either operation. Unsigned absolute is identity; unsigned negate wraps modulo 2**WIDTH and overflows for every nonzero input. zero/negative describe y; negative=0 in unsigned mode. |
| ss_bitwise | OPERATION 0 AND, 1 OR, 2 XOR, 3 NAND, 4 NOR, 5 XNOR, 6 NOT a. y and zero; b is ignored only for NOT. |
| ss_shift_rotate | OPERATION 0 logical left, 1 logical right, 2 arithmetic right, 3 rotate left, 4 rotate right. amount is an unsigned seven-bit bus (0–127). Logical shifts ≥WIDTH give zero; arithmetic right preserves the sign; rotates use amount modulo WIDTH. Unknown amount produces X data/zero=0 in simulation. |
| ss_reduce | all_one=AND reduction; any_one=OR reduction; xor_reduce=XOR reduction. even_parity is the bit to **append** for an even total number of ones; odd_parity is its inverse. Unknown bits follow std_logic operations. |

Addition/subtraction flags are independent: carry/borrow always describe the unsigned bit arithmetic, while signed overflow uses the configured signed interpretation. Subtraction carry=0 and addition borrow=0. Neither operation saturates. For chained words, route the lower word's carry/borrow into the next word's cin using the same operation.

### Divider handshake

All state changes occur on the rising edge of a real shared clock. rst is synchronous active high and clears outputs/status regardless of en. Pulse start for one clock while busy=0. An accepted start captures a/b independently of en, clears previous valid/errors and starts the calculation; later operand changes are ignored. Start while busy is ignored, including on the final progress edge.

Successful division takes **WIDTH subsequent enabled edges** after the start edge. en=0 pauses progress. Results retain their previous value during calculation, so use valid/busy. On completion busy=0, done=1 for one source-clock cycle, valid=1, and quotient/remainder update together. done clears on the next source edge even if en=0. valid stays high until reset or a new accepted start. Holding start high can start another operation once idle; use a one-clock trigger.

For signed inputs, quotient truncates toward zero and remainder has the dividend's sign: −7 / 3 gives quotient −2, remainder −1. Always a=b×quotient+remainder for valid results.

Error cases finish **on the accepted start edge** without a busy interval:

- b=0: quotient=0, remainder=a, divide_by_zero=1, overflow=0, done=1, valid=0.
- Signed minimum / −1: quotient retains the signed minimum bit pattern, remainder=0, overflow=1, divide_by_zero=0, done=1, valid=0.

zero/negative describe the stored quotient even for an error result; they do not substitute for valid. At 50 MHz, WIDTH=64 needs 64 enabled progress clocks, or 1.28 microseconds after capture, when en remains high. This is a cycle-count calculation, not measured FPGA timing.

## Comparisons and ranges

All four blocks use WIDTH and SIGNED_MODE. Data and runtime bounds must use the same interpretation.

- `ss_compare`: eq, lt, gt, le and ge for a versus b.
- `ss_min_max`: minimum/maximum are the ordered pair of a/b.
- `ss_range_check`: d between minimum/maximum. INCLUDE_MIN and INCLUDE_MAX independently choose inclusive (1) or exclusive (0) endpoints. bounds_valid=1 exactly when minimum≤maximum. Invalid bounds give within=0. Equal bounds are ordered, but any exclusive endpoint makes the accepted set empty.
- `ss_clamp`: y clips d into an **inclusive** range, with valid=1 and clipped=1 only when y changes. Invalid bounds pass d through with valid=0/clipped=0.

Existing primitive comparators remain unchanged. These external blocks add explicit signedness and range behavior without changing legacy projects.

## Priority encoder

`ss_priority_encoder` supports INPUTS=1–64; d is that wide. Its code port is always **six bits**, enough for input indices 0–63. PRIORITY_HIGH=1 chooses the highest asserted input index; 0 chooses the lowest. ONE_HOT_ONLY=1 accepts exactly one asserted input; 0 accepts priority selection among several.

With en=1, valid indicates an accepted input and multiple=1 means at least two bits were asserted, even if strict one-hot mode rejects them. No input or a rejected multiple-input case gives code=0/valid=0. With en=0, code/valid/multiple are all zero. Input index zero therefore gives code=0 **with valid=1**, unlike no active input. Inputs are assumed stable binary levels; synchronize external controls as appropriate.

## BIN ↔ BCD

Both conversions are combinational and use WIDTH=1–64, DIGITS=1–20 and SIGNED_MODE. They expose separate status instead of silently treating an invalid conversion as a number.

### ss_bin_to_bcd

d is binary; bcd_lo/bcd_hi contain the **full unsigned magnitude**. Signed negative input sets negative=1; signed minimum's magnitude is preserved exactly (2**(WIDTH−1)). DIGITS sets the allowed displayed digit count, not the width of those output pins. If the magnitude requires more digits, overflow=1/valid=0 and the full twenty-digit payload is still available. Otherwise valid=1/overflow=0. Unknown d in simulation gives zero digits/negative=0/valid=0/overflow=0.

Example unsigned maximum at WIDTH=64:

```text
18446744073709551615
bcd_hi = 0x1844
bcd_lo = 0x6744073709551615
```

### ss_bcd_to_bin

Connect bcd_lo/bcd_hi and separate negative. Used and unused nibbles must be decimal 0–9. Nonzero nibbles outside DIGITS cause overflow; values outside the configured binary signed/unsigned range also cause overflow. Unsigned mode rejects negative nonzero magnitudes; a negative zero is accepted as zero. Signed positive limit is 2**(WIDTH−1)−1; negative magnitude limit is 2**(WIDTH−1).

Invalid decimal nibble or unknown input/sign sets invalid_digit=1/valid=0/overflow=0, taking precedence over range overflow. Numeric overflow gives overflow=1/valid=0/invalid_digit=0. Every failed conversion returns y=0; always check valid. Successful conversion returns exact binary y and valid=1.

For a round trip, configure both boxes with the same WIDTH/DIGITS/SIGNED_MODE and connect both BCD halves plus negative. Unconnected high digits default zero in the component package, useful when at most sixteen digits are supplied.

## ASCII formatting

### ss_digit_ascii

One four-bit digit becomes an eight-bit character. HEX_MODE=0 accepts 0–9; HEX_MODE=1 also accepts 10–15, rendered A–F or a–f by UPPERCASE. Decimal-invalid or unknown input gives ASCII `?` (0x3F) with valid=0. Valid characters are 0x30–0x39 and 0x41–0x46/0x61–0x66.

### ss_number_formatter

Connect packed digit buses digits_lo[64]/digits_hi[16], negative and input_valid. For decimal use, connect ss_bin_to_bcd outputs directly. For HEX use, the same nibbles contain the unsigned magnitude's hexadecimal digits; zero-extend a narrower binary bus to 64 bits and set digits_hi=0. For negative HEX formatting, first provide an unsigned magnitude plus the separate sign.

| Generic | Behavior |
|---|---|
| DIGITS 1–20 | Fixed number of numeric cells, excluding sign and decimal point |
| HEX_MODE 0/1 | Decimal/HEX digit validity and alphabet |
| SIGNED_DISPLAY 0/1 | With 1, reserve the first cell for '-' or a space; with 0, reject negative input as overflow |
| LEADING_ZERO 0/1 | Leading spaces/zeros; preserve at least the last integer digit and all fractional digits |
| FRACTION_DIGITS 0–DIGITS | Insert a fixed decimal point this many digits from the right; this changes presentation, not the numeric input |
| UPPERCASE 0/1 | Lowercase/uppercase HEX letters |

When FRACTION_DIGITS=DIGITS, prepend `0.` before all fractional digits. The largest field is 23 characters (sign + `0.` + twenty digits), fitting the fixed 32-cell output. All unused cells are ASCII spaces. length[5] is the field length, including its sign/dot cells, even for errors.

Byte order:

```text
text_0 bits  7:0   = character 0  (leftmost)
text_0 bits 15:8   = character 1
text_0 bits 63:56  = character 7
text_1            = characters 8–15, same byte order
text_2            = characters 16–23
text_3            = characters 24–31
```

Use existing Bus Tap or ss_bus_slice with OUT_WIDTH=8 and LSB=8×cellWithinBus to feed a character into a later LCD module. Numeric BCD output from the converter can also feed a later seven-segment module directly.

With input_valid=1 and known data/sign, digits beyond DIGITS or a negative input without a sign cell give overflow=1/valid=0 and all field cells become `#` (0x23). This overflow takes precedence over invalid decimal digits. Otherwise invalid decimal digits give question marks with valid=0/overflow=0. Unknown data/sign or input_valid≠1 gives question marks without evaluating overflow. No saturation, digit loss or character omission is hidden.

Example: DIGITS=5, SIGNED_DISPLAY=1, FRACTION_DIGITS=2, LEADING_ZERO=0. Magnitude 123 with negative=1 renders `-  1.23`; zero renders `   0.00`. The sign always occupies its own first cell.

## Ready-to-paste schematic examples

- [Signed binary → decimal ASCII](examples/phase7-signed-number.schtxt): import `packs/conversion.sccomp.json` and `packs/formatting.sccomp.json`, then paste through **Tools → Import Schematic Text…**. Input is signed 16-bit hundredths: −1234 renders `- 12.34`. It wires every input explicitly, so the matching two raw VHDL imports also work.
- [Signed 64-bit divider](examples/phase7-divider.schtxt): import `packs/arithmetic.sccomp.json` or the individual divider. Connect the real clock, reset, one-clock start and enable; observe valid/done before consuming quotient/remainder.

Select the imported sheet as **Top entity** before generating its VHDL bundle. All module settings can be edited in Inspector; port changes preview affected wires before Apply and remain undoable. Open source only when you want to edit internal behavior.

## Validation boundary

Tests load the actual Studio parser/importer/exporter, use BigInt reference values, simulate generated bundles with GHDL and synthesize representative 64-bit configurations. They cover one-bit/odd/32/64 widths, signed extremes and flags, full products, divider control/timing/errors, encoder priority, conversion validity and full twenty-digit results, and exact ASCII byte order/error fields. Browser smoke covers raw import and a complete BIN→BCD→ASCII schematic.

The serial full suite passed 580/580 with no failures/skips. A small numeric-field range adjustment made after that run started passed 43 focused import/editor/parameter checks and browser preview/Apply at DIGITS=20/FRACTION_DIGITS=20; the entire suite was not repeated for that isolated UI change. The exact browser-exported example also compiled and synthesized with GHDL.

Combinational multiplication and conversion circuits can consume substantial resources or require pipelining on a specific FPGA. Local GHDL synthesis is not a Vivado resource/timing result or a physical EDGE Spartan-7 board test. These files do not include pin constraints or physical LCD/seven-segment/SPI ADC drivers; those are Phase 8.
