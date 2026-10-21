# Importable FPGA modules

These files include plain VHDL sources and Schematic Studio component packages. The editor does not install this catalog automatically. Source and configuration are embedded in the project after import, so the original files are not needed to reopen it.

## Folder guide

All 49 supplied modules, import packs, examples and download files live here:

```text
fpga-exam-kit/modules/
├── README.md            Start here: module index and import instructions
├── PHASE6.md            Counter/timing/bus/ROM wiring and settings
├── PHASE7.md            Arithmetic/comparison/conversion/ASCII contracts
├── PHASE8.md            Seven-segment/LCD/accepted ADC wiring and timing
├── PHASE9.md            Button/ALU/FSM/MM:SS compositions and import paths
├── packs/               Fourteen category .sccomp.json packs
├── registers/           PIPO, SIPO, PISO, SISO, Universal (5)
├── input-conditioning/  Synchronizer, Debounce, Edge Detector (3)
├── timing/              Counter, Skip Counter, Tick, Divider, Timer, PWM (6)
├── bus/                 Slice, Concat, Reverse, Extend, Truncate (6)
├── lookup/              Editable LUT/ROM (1)
├── arithmetic/          Add/sub, Multiply, Divide, Unary, Bitwise, Shift, Reduce (7)
├── comparison/          Compare, Range Check, Clamp, Min/Max (4)
├── encoding/            Priority/strict one-hot Encoder (1)
├── conversion/          BIN to BCD and BCD to BIN (2)
├── formatting/          Digit ASCII and Number Formatter (2)
├── seven-segment/       Decoder, Pattern Packer, Scanner (3)
├── lcd/                 Byte Writer, LCD16×2, Text Overlay (3)
├── adc/                 Accepted lab export, Sample Valid Adapter (2)
├── compositions/        Button Input, ALU, editable FSM, MM:SS Timer (4)
├── examples/            Ready-to-paste Schematic Text circuits
└── downloads/           ZIP bundles
```

Every module's `.vhd` source and individual `.sccomp.json` package stay together in its category folder. Import category packs from [packs/](packs/), or pick individual modules from the category folders below.

Examples: [Timed counter 10–88](examples/phase6-timed-counter.schtxt), [64-bit counter skipping 3 and 7](examples/phase6-skip-counter64.schtxt), [Signed BIN→BCD→ASCII](examples/phase7-signed-number.schtxt), [64-bit signed divider](examples/phase7-divider.schtxt). Downloads: [Phase 6 bundle](downloads/phase6-modules.zip), [Phase 7 bundle](downloads/phase7-modules.zip), [Phase 8 bundle](downloads/phase8-modules.zip), [Phase 9 bundle](downloads/phase9-modules.zip). The design plan remains one level up at [DESIGN_PLAN.md](../DESIGN_PLAN.md).

Examples for display hardware: [Four decimal digits](examples/phase8-sevenseg.schtxt), [Dynamic LCD value](examples/phase8-number-lcd.schtxt), [Accepted lab ADC display](examples/phase8-adc-sevenseg.schtxt).

Composed examples: [64-bit signed ALU](examples/phase9-alu.schtxt), [Buttons → MM:SS → seven-segment](examples/phase9-button-timer.schtxt), [MM:SS → LCD](examples/phase9-mmss-lcd.schtxt). The [editable FSM template](compositions/ss_fsm_template.sch.txt) produces the matching VHDL source. See [PHASE9.md](PHASE9.md) for all four compositions.

## Import and use

1. Open the target project in [Schematic Studio v2](../../schematic2vhdl-v2/index.html).
2. Click **Import Module…** in Project or Components and select `.vhd` files. For a file containing several entities, choose the modules to expose or one root module; dependencies are included automatically. To import a `.sccomp.json` package instead, use **Tools → Import Component Package…**.
3. Click or drag a module from Components or **Project → USE AS SUB-BLOCK** onto the canvas. Set width and other generics in the Inspector before or after placement.
4. Connect its named input/output pins. Each instance has independent settings. Changes apply directly unless they affect connected ports or discard values; those changes show their impact before Apply.
5. Save the project normally. Import and placement are separate Undo steps.

For component packages, import a category pack **or** the individual files it contains; duplicate entities are rejected. Raw VHDL import skips equivalent existing definitions and reports conflicting sources without overwriting them. Importing several files is one transaction: an invalid/conflicting file prevents the entire batch from being installed.

The compositions pack and its individual packages include existing dependencies. For a project that already has those dependencies, use [the roots-only add-on](compositions/existing-project.sccomp.json), which installs four new definitions and preserves installed sources. Use the [complete pack](packs/compositions.sccomp.json) for a new project. Choose one import route; duplicate names are rejected. See PHASE9.md for the dependency list.

## Files

| Category pack | Individual modules | Settings |
|---|---|---|
| [Registers](packs/registers.sccomp.json) | `registers/ss_reg_{pipo,sipo,piso,siso,universal}.sccomp.json` | WIDTH 1–64; enable; rising/falling edge; sync/async reset; direction or mode where applicable |
| [Input conditioning](packs/input-conditioning.sccomp.json) | `input-conditioning/ss_input_{sync,debounce,edge}.sccomp.json` | Synchronizer stages/reset level; Debounce stable interval/polarity; Edge Detector rising/falling/both |
| [Timing](packs/timing.sccomp.json) | `timing/ss_{counter,counter_skip,tick,clock_divider,timer,pwm}.sccomp.json` | Counter/timer/PWM WIDTH 1–64; bounded up/down counting; four skip slots; integer division; retrigger and polarity |
| [Bus](packs/bus.sccomp.json) | `bus/ss_bus_{slice,concat,reverse,zero_extend,sign_extend,truncate}.sccomp.json` | Explicit bit mappings and widths up to 64; dependent bounds prevent impossible settings |
| [Lookup](packs/lookup.sccomp.json) | `lookup/ss_rom.sccomp.json` | Editable table with up to 64 entries, 1–64-bit data and combinational/clocked reads |
| [Arithmetic](packs/arithmetic.sccomp.json) | `arithmetic/ss_{add_sub,multiply,divide,unary,bitwise,shift_rotate,reduce}.sccomp.json` | WIDTH 1–64; signed/unsigned; operation selection; overflow/error flags; iterative divider handshake |
| [Comparison](packs/comparison.sccomp.json) | `comparison/ss_{compare,range_check,clamp,min_max}.sccomp.json` | WIDTH 1–64; signed/unsigned; range endpoint inclusion |
| [Encoding](packs/encoding.sccomp.json) | `encoding/ss_priority_encoder.sccomp.json` | INPUTS 1–64; high/low priority; strict one-hot; valid/multiple flags |
| [Conversion](packs/conversion.sccomp.json) | `conversion/ss_{bin_to_bcd,bcd_to_bin}.sccomp.json` | WIDTH 1–64; DIGITS 1–20; signed magnitude; exact split digit buses and range validation |
| [Formatting](packs/formatting.sccomp.json) | `formatting/ss_{digit_ascii,number_formatter}.sccomp.json` | Decimal/HEX; sign; leading zeros/spaces; fixed fractional position; letter case |
| [Seven-segment](packs/seven-segment.sccomp.json) | `seven-segment/ss_sevenseg_{decode,digits,scan}.sccomp.json` | Decimal/HEX/raw; 1–16 cells; blank/dot masks; pattern scanning; segment/common polarity |
| [LCD](packs/lcd.sccomp.json) | `lcd/ss_{lcd_write,lcd16x2,text_overlay}.sccomp.json` | Parallel 8-bit data/E/RS/RW; 32 character cells; field offset/length; adjustable clock-count timings |
| [Compositions](packs/compositions.sccomp.json) | `compositions/ss_{button_input,alu,fsm_template,mmss_timer}.sccomp.json` | Button polarity/debounce/events; ALU WIDTH 1–64 signed/unsigned; editable three-state FSM; bounded up/down MM:SS |
| [ADC](packs/adc.sccomp.json) | `adc/ss_{spi_adc_lab,adc_sample_valid}.sccomp.json` | Original fixed 12-bit lab protocol; sample events; independent WIDTH 1–64 event adapter |

Each individual package has a matching `.vhd` file in the same directory. Packages include that exact VHDL plus Studio descriptions, friendly parameter choices and explicit unused-input defaults. The original eight register/input modules retain their source; Phase 6 adds thirteen external modules, Phase 7 adds sixteen, Phase 8 adds eight, and Phase 9 adds four compositions. The individual LCD16×2 package includes its byte-writer dependency; importing the LCD pack also includes it. See [PHASE6.md](PHASE6.md), [PHASE7.md](PHASE7.md) [PHASE8.md](PHASE8.md) and [PHASE9.md](PHASE9.md) for wiring, timing contracts, examples and limits.

## Register behavior

All registers require `clk`. Unconnected `en=1`, `rst=0`, `reset_value=0`; reset overrides enable. Initial state is zero. Connect a WIDTH-bit CONST for an exact reset value. Asynchronous reset values must be static (CONST/GND/VCC); use synchronous reset for a runtime value.

- PIPO: parallel `d` → `q` at an enabled clock edge.
- SIPO: serial `si` → parallel `q`.
- PISO: enabled `load` takes priority over shifting; `so` is the current end bit, sampled before the next shift.
- SISO: serial input/output through WIDTH storage bits.
- Universal: `mode=00` hold, `01` shift left, `10` shift right, `11` parallel load. `so_left` is the current MSB; `so_right` is the current LSB.

## Input conditioning

All three modules require a continuously running rising-edge `clk`, use synchronous active-high `rst` and default unconnected `rst` to zero.

- SYNC: one-bit level synchronizer, STAGES 2–64. Digital simulation does not model metastability; short pulses and coherent buses need other transfer designs.
- DEBOUNCE: feed synchronized `d`. `q=1` means active/pressed. STABLE_CYCLES consecutive opposite samples change q; `pressed`/`released` last one clock. The **ตั้งระยะนิ่ง (ms)** helper converts at CLOCK_HZ and rounds up; default 50 MHz is the EDGE Spartan-7 board context, not a generated clock.
- EDGE: feed a synchronous `d`. `rise`/`fall` report transitions; MODE selects `pulse`. The first valid sample after reset establishes history without an event.

Typical connection: raw input → SYNC → DEBOUNCE → optional EDGE, sharing clock/reset. Set SYNC.RESET_LEVEL = DEBOUNCE.ACTIVE_LOW to initialize at the physical inactive level.

## Edit source and update

Use a package for the supplied defaults and friendly controls. To edit an imported module, double-click its box to open the source editor in the Inspector, edit the VHDL and click **Update**. Keep the original entity name. Source changes affect all instances of that definition; per-instance generic settings remain independent. **Export package** is available in the same editor.

Editing a disk `.vhd` does not automatically update its `.sccomp.json` or a saved project. **Tools → Import VHDL Module…** also accepts the `.vhd` directly, but a raw VHDL file carries no Studio-specific defaults/notes. It retains generics and named ports; wire its inputs explicitly.

## Existing projects and Schematic Text

Old saved projects already embed `CUSTOM:*` boxes and sources. They continue to work without importing these files. Imported boxes now appear in REUSABLE CIRCUITS.

After importing the relevant package, Schematic Text can reference `CUSTOM:ss_reg_sipo` or `CUSTOM:ss_input_debounce`, with settings such as `generic_WIDTH=64`. The former transient `LIB:*` aliases are no longer available; replace those references with the imported CUSTOM names. **Copy Circuit Info for AI…** lists the modules actually available in the project.

Visual resizing is available through the Inspector and drag handles; it does not change electrical widths. Display/ADC packs and composed lab modules are available; see PHASE8.md and PHASE9.md. Earlier ZIP bundles remain historical snapshots with their original indexes. No Vivado or physical-board result is implied by this delivery.
