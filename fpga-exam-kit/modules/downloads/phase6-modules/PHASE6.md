# Phase 6: counters, timing, buses and lookup

These thirteen modules are external files. Category packs are in `packs/`; individual `.sccomp.json` files and matching `.vhd` sources are together in `timing/`, `bus/` and `lookup/`. Import only the files you need through **Tools → Import Component Package…**. The editor starts without this catalog. The matching `.vhd` can also be imported directly through **Tools → Import VHDL Module…**, but then every input must be wired explicitly: raw VHDL carries no package notes/defaults. Generic settings belong to each placed instance; source belongs to the shared module definition.

## Clock and control conventions

All sequential modules sample on the rising edge of `clk`. Use the board's continuous 50 MHz clock and connect slower events to `en`. Reset is synchronous, active high and independent of enable. Connect/reset after power-up; initialized internal state is zero, which may lie outside a configured counter range. ROM registered outputs require a reset/clock before their first known value.

Package defaults: `rst=0`, `en=1`, `load=0`, `down=0`, `minimum=0`, `load_value=0` where those pins exist. Timer also defaults `start=0`, `cancel=0`; skip slots default zero and are ignored when SKIP_COUNT=0. ROM defaults `clk=0`, `rst=0` for combinational use; CLOCKED=1 requires an actual clock connection. Counter `maximum`, timer `duration`, PWM `period/duty`, ROM `addr` and bus data inputs must be connected.

`wrapped`, `tick` and `done` indicate events for one source-clock cycle and clear even while `en=0`. Consecutive events can remain high on consecutive clocks. Downstream sequential blocks observe a registered event at the **next** rising edge; for a DIVISOR=3 tick feeding counter.en, the first count occurs on edge 4 after reset, then edges 7, 10, etc. With a 50 MHz source that is a 20 ns registered-control delay, not an extra period. Keep the source clock common to both blocks.

## Counter: ss_counter

| Setting/pin | Meaning |
|---|---|
| WIDTH | 1–64 bits, unsigned values throughout |
| WRAP | 1: wrap at boundary; 0: hold at boundary |
| minimum, maximum | Inclusive runtime bounds, each WIDTH bits |
| down | 0: increment; 1: decrement |
| rst | Select minimum when up, maximum when down |
| load/load_value | Clamp and capture load_value into the range, even when en=0 |
| en | Advance one allowed step when high |
| q / valid | Current value / valid bounds and current value in range |
| terminal | Current value is the numeric endpoint for the selected direction |
| wrapped | One-clock pulse when counting crosses the boundary |

Priority is reset → load → enabled count. When minimum > maximum, load/count hold and valid=0; reset still selects the configured directional start. If bounds change and q is outside them, the next enabled edge recovers to the directional start. WIDTH=64 retains all bits; values never pass through VHDL integer or JavaScript Number.

Example 10→88 up: WIDTH=8, minimum=10, maximum=88, down=0. For 88→10, set down=1 and reset. For a runtime start in the middle of the range, pulse load with load_value set to that value.

## Skip counter: ss_counter_skip

Same bounds, controls and priorities, with four WIDTH-bit inputs `skip_0`–`skip_3`. Set SKIP_COUNT=0–4 to use the first N slots. `valid` also checks that q is not excluded. There is no `terminal` output because the last allowed value may precede the numeric endpoint.

Example 0–9 skipping 3 and 7: WIDTH=8, SKIP_COUNT=2, maximum=9, skip_0=3, skip_1=7. Up sequence: **0,1,2,4,5,6,8,9,0**. Down sequence: **9,8,6,5,4,2,1,0,9**. Excluded candidates are skipped within a single clock edge; each event still advances to only one allowed result.

Reset finds the first allowed value in the selected direction. A load onto an excluded number searches forward in that direction; loads outside the range clamp first. WRAP=0 stops if no allowed successor exists, including when the endpoint itself is excluded. Duplicates and values outside the range are harmless. If every value is excluded, counting holds and blocked=1; reset selects the directional bound with valid=0. `blocked` records the latest attempted reset/load/count with no result, including stop mode or invalid bounds; it retains its value during a pause. `wrapped` is high only for a successful result crossing the boundary.

This version has **four exclusion slots**, not an unlimited list. All four values can be changed at runtime. More exclusions require extending the source/interface; use the ROM for an explicit custom sequence. Changing a skip input can make the current q invalid; the next enabled edge recovers to the first allowed value. Avoid asynchronous switch changes: synchronize/debounce control inputs before using them.

## Tick and divider

- `ss_tick`: DIVISOR=1–2147483647; tick every D enabled edges. DIVISOR=1 means an event on every enabled clock (consecutive high cycles). en=0 preserves the count and clears tick; reset restarts the phase.
- `ss_clock_divider`: DIVISOR=2–2147483647; `clk_out` low for ceil(D/2) edges, high for floor(D/2), with tick at each falling period boundary. Starts low; en=0 holds phase **and output level**, so disabling while high leaves it high. Reset brings it low on a clock edge.

For either module, rate = Fclk / DIVISOR. At 50 MHz, D=50000000 gives 1 Hz and D=50000 gives 1 kHz. Only integer divisors are supported; a requested frequency that does not divide 50 MHz exactly must use an approximate rate. Odd divisors have unequal high/low durations. Use tick for synchronous enables. Routing clk_out as an FPGA clock requires clock-routing and timing constraints in the downstream tool; these files do not supply those constraints.

## Timer / delay / one-shot: ss_timer

WIDTH=1–64; duration is an unsigned WIDTH-bit bus. Pulse start for one clock to capture it. busy/pulse remain high during the active interval. After N **subsequent enabled** edges, remaining reaches zero and done pulses for one source clock. duration=0 completes on the start edge without an active pulse. Changing duration while active has no effect until another accepted start.

Priority: reset/cancel → accepted start → enabled progress. Both reset and cancel clear activity without emitting done. RETRIGGER=1 accepts start while busy and restarts from the new duration; RETRIGGER=0 ignores it while busy and continues normal enabled progress. Accepted starts work with en=0. Holding start high in retrigger mode repeatedly restarts the timer, so use the input EDGE module or another single-clock trigger.

Use done for a delayed event, pulse for a one-shot interval and remaining for a countdown display. en=0 pauses remaining and stretches the pulse. At 50 MHz, duration=50000000 and WIDTH≥26 give a one-second interval; use a slower tick on en if the duration is expressed in seconds instead of clock cycles.

## PWM: ss_pwm

WIDTH=1–64; period and duty are unsigned buses. Output is active while phase < duty, with frequency Fclk / period when continuously enabled. duty=0 gives 0%; duty≥period clamps to 100%; period=0 yields valid=0 and the inactive level. ACTIVE_LOW=1 inverts both active and inactive levels.

Settings capture on the first enabled clock and each period boundary. Changes during a period wait until the next boundary; pulse load to capture immediately and restart at phase zero, even with en=0. A zero period retries capture on every enabled clock until a nonzero setting arrives. en=0 drives the inactive level immediately and preserves phase; resuming continues it. rst also forces the inactive output immediately and clears stored configuration on its next rising edge. Dynamic enable/reset can therefore shorten the current pulse; use synchronous control signals.

## Bus utilities

| Entity | Mapping / bounds |
|---|---|
| ss_bus_slice | y[j]=d[LSB+j]; OUT_WIDTH≤IN_WIDTH; LSB+OUT_WIDTH≤IN_WIDTH |
| ss_bus_concat | y=a & b; a occupies MSBs, b LSBs; A_WIDTH+B_WIDTH≤64 |
| ss_bus_reverse | y[i]=d[WIDTH−1−i], WIDTH=1–64 |
| ss_bus_zero_extend | Preserve d and fill upper bits with zero; OUT_WIDTH≥IN_WIDTH |
| ss_bus_sign_extend | Preserve d and repeat its original MSB; OUT_WIDTH≥IN_WIDTH |
| ss_bus_truncate | Keep low OUT_WIDTH bits; lost=OR of discarded upper bits |

All are combinational; data widths are 1–64 bits. Concat inputs are nonempty, so each is at most 63 bits. `lost` is a discarded-one indicator, **not** a signed-overflow flag; unknown discarded bits propagate when they cannot be resolved. Equal input/output widths work. Raw VHDL instantiation should specify all dependent generics together when changing widths; unchanged defaults may otherwise violate the new bounds.

In Studio, edit dependent widths in a valid order: reduce OUT_WIDTH before reducing IN_WIDTH on Slice/Truncate, and increase OUT_WIDTH before increasing IN_WIDTH on extensions. Parameter preview rejects impossible mappings and lets you review affected wires before applying. Visual box size is independent of these electrical settings.

## Editable LUT / ROM: ss_rom

DATA_WIDTH=1–64, ADDR_WIDTH=1–6, ENTRY_COUNT=1–2**ADDR_WIDTH, CLOCKED=0/1. The table has 64 physical source entries; ENTRY_COUNT selects the accessible prefix. Its default entries 0–7 contain 0–7, and other entries contain zero. ENTRY_COUNT=8 requires ADDR_WIDTH≥3; lower address widths must also reduce ENTRY_COUNT.

Edit `TABLE_DATA` in ss_rom.vhd using 16-digit hex values, for example `3=>x"0000000000000041"` for ASCII A or `7=>x"FEDCBA9876543210"` for a 64-bit value. Then open the imported module's Inspector **พอร์ต / source / Export package → Change source**, paste the edited VHDL, review and Apply. Keep the entity name. Export its updated package if you want a reusable file. Editing the disk `.vhd` alone does not update an existing package/project. Source changes affect every instance of that definition.

Every accessible table value must fit DATA_WIDTH; GHDL asserts on a value too large instead of silently losing its upper bits. For a one-bit LUT, change used entries to 0 or 1 or limit ENTRY_COUNT appropriately. Interface preview does not execute VHDL assertions; compile/simulate the changed source before use.

CLOCKED=0 is combinational and ignores clk/rst. CLOCKED=1 samples addr on each rising clock and updates data/valid after that edge; synchronous reset outputs zero/valid=0. Out-of-range or unknown addresses output zero/valid=0 in either mode. This is a small editable lookup table; synthesis may implement distributed logic/ROM or registers rather than a specific block-RAM resource.

## Example: one-clock timed counter in Schematic Text

Import `packs/timing.sccomp.json` first, then use **Tools → Import Schematic Text…**:

```text
format schematic-text 1
circuit timed_count
input clk, rst
output result[8]
use "CUSTOM:ss_tick" as tick_module
use "CUSTOM:ss_counter" as count_module
part tick @tick_module generic_DIVISOR=50000000
part count @count_module generic_WIDTH=8
part limit CONST value="58" width=8
part first CONST value="0A" width=8
connect clk -> tick.clk, count.clk
connect rst -> tick.rst, count.rst
connect tick.tick -> count.en
connect first.o -> count.minimum
connect limit.o -> count.maximum
connect count.q -> result
```

CONST values in Schematic Text are hexadecimal: 58 hex = 88 decimal and 0A hex = 10 decimal. The same connections can be made by dragging wires in the schematic. The package supplies the unused defaults; no VHDL top-level coding is required. Select the imported sheet as the project's **Top entity** before generating its complete VHDL bundle.

Ready-to-paste files are in [examples/phase6-timed-counter.schtxt](examples/phase6-timed-counter.schtxt) and [examples/phase6-skip-counter64.schtxt](examples/phase6-skip-counter64.schtxt). The latter wires every input explicitly and also works after importing the raw skip-counter VHDL. The downloadable bundle is [downloads/phase6-modules.zip](downloads/phase6-modules.zip).

## Validation boundary

The automated tests use the actual Studio importer and exporter, verify individual/package source parity, independent generics, validation/persistence/Undo, simulate boundary and timing cases with GHDL, and synthesize representative generated bundles including all module types. These are local digital-logic checks, not a Vivado timing result or a physical EDGE Spartan-7 board test. Arithmetic/conversion and display/ADC modules remain later phases.
