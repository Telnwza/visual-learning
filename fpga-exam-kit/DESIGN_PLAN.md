# Schematic Studio — Configurable Components, Faster Wiring and VHDL Modules

Date: 2026-10-11 (Asia/Bangkok)
Updated: 2026-10-21 (Asia/Bangkok)
Status: Stages 1–9 and the scoped UX implementation are delivered locally, including in-app VHDL creation and source editing. UX-E automated checks, legacy parsing and a downloaded VHDL simulation passed. On 2026-10-20 the user chose to skip further extensive manual verification; the [checklist](UX_MANUAL_TESTS.md) remains optional reference, not a gate for further work. Unperformed checks are not recorded as passed.

Version split: the enhanced application and its tests now live in `schematic2vhdl-v2/`; `schematic2vhdl/index.html` is byte-for-byte the verified GitHub original at commit `a101f195790a4a833e98c271d1fda3a50b0807d3`. New work targets v2. The dashboard links to both versions, browser storage is isolated, and the portable project/module formats are unchanged. Historical commands below record their original paths; linked test files now point to v2.

This replaces the previous fixed-width exam-library plan and separate B06 register-wrapper design. Improve Schematic Studio itself first, then deliver configurable blocks as external files that users import, place and connect visually. Stage 5A adds a hybrid workflow: VHDL implements a module's internals while schematic provides its visible ports and connections. The earlier standalone generator drafts are inactive and outside this plan.

## 1. Scope

- Highest priorities: enable inputs on flip-flops, 32/64-bit support, and connections across multiple components in one operation.
- The catalog also includes input conditioning, event/timing blocks, bus utilities and lookup tables. Build frequently used larger blocks by composing these foundations.
- Schematic remains the main workflow. Configure components in the Inspector or before placement; use VHDL modules as boxes without needing to open or convert their internals into drawn gates.
- Add easy visual resizing for every placeable component, including primitives and schematic/VHDL module boxes. Delivered in Stage 5E; changing drawing size remains separate from changing bit width, input count or circuit behavior.
- Deliver common modules as separate `.sccomp.json` import packages and editable `.vhd` sources under `fpga-exam-kit/modules/`. Studio supplies import, per-instance configuration, port previews and wiring; it does not embed a common-module source catalog. Provide both individual modules and category packs.
- Accept supplied lab modules as working. Preserve their files, timing and hardware conventions; do not re-audit or retest unchanged lab logic.
- Preserve old projects, component defaults, manual routing, Placement Mode, layout locking, Bus Tap helpers, port ordering and diagnostics.
- Board context: EDGE Spartan-7, 50 MHz. Reuse working LCD and SPI ADC circuits in later stages.
- The user authorized Stages 1–9, the hybrid-plan revision and the external-file delivery migration. Stage 9 was requested on 2026-10-11. Git mutations, deployment and board programming are outside this authorization.

## 2. Current findings

| Area | Current behavior | Planned change |
|---|---|---|
| D/JK/T/SR flip-flops | One-bit, clock-edge selection, optional async reset/preset; Stage 1 adds optional enable. Stage 5C supplies separate PIPO/bus D-FF and shift-register boxes at 1–64 bits. | Wider JK/T/SR variants remain a separate later contract. |
| Data widths | Stage 2 supports integer widths 1–64 for IN/OUT, gates, CONST, MUX/DEMUX data and comparators; Inspector presets 8/16/32/64. | New storage/data blocks follow in later stages. |
| Channel counts | Stage 2 adds 32/64 choices to MUX/DEMUX and encoder/decoder, separately from data width; Stage 4 previews ports before placement. | Use these foundations in later configurable blocks. |
| Bus Tap | Supports start bit 63, slice width 64, direct range entry and mapping preview; split/merge and continuous placement remain available. | Reuse in later bus utilities. |
| CONST | Exact Decimal/Hex/Binary entry, equivalent values and overflow feedback; JSON values remain hex strings. | Reuse for configurable block parameters. |
| Wiring | Stages 3–4 add continuous source, sweep and selected-component group connections using existing fan-out/junction helpers. | Pairwise mapping is delivered in the editor follow-up below. |
| Parameter changes | Preview covers removed ports/wires, connected width/direction changes, exact constant truncation, and parent-sheet wires affected by child IN/OUT width changes. | Reuse for later configurable blocks. |
| Subcircuits | Module width/height controls drawing size, not internal logic width. | Implement configurable behavior explicitly rather than resizing the symbol. |
| Custom VHDL blocks | Stage 5A imports fixed-interface VHDL into existing `CUSTOM` boxes, with embedded source, typed ports and dependency-aware exports. | Stage 5B adds independent integer generic settings, interface previews and source replacement using this same path. |
| VHDL import | One-module files import directly. Bundles offer selected module boxes, one root box with dependencies, or restored stamped schematics with custom definitions. | Delivered in the bundle-import follow-up below; interface constraints remain explicit. |

Primary source: `schematic2vhdl-v2/index.html`. Extend existing type registry, Inspector, routing, serializer, text importer and VHDL generation. Use the existing focused test structure under `schematic2vhdl-v2/`; no new framework is needed.

## 3. Flip-flop enable — Stage 1 implemented

Apply to D-FF, JK-FF, T-FF and SR-FF:

- Inspector option exposes an active-high, one-bit `en` input.
- EN is on the left edge; existing port coordinates, symbol dimensions and legacy defaults are preserved.
- At the selected clock edge, `en=1` applies the original transition; `en=0` holds Q and Q-bar.
- Keep clock directly connected. Enable is a clock enable, not an AND-gated clock.
- Existing asynchronous reset/preset act immediately regardless of enable. Preserve reset > preset > enabled clocked operation.
- With enable absent/disabled, retain existing ports and behavior. Old saved circuits need no new wire.
- Exposed but unconnected enable receives a missing-input diagnostic and visible fallback behavior; do not silently assume enabled.
- Preserve original D/JK/T/SR transition rules, including existing SR handling.
- Include enable consistently in symbol geometry, ports, Inspector, diagnostics, Schematic Text/catalog, save/load and VHDL generation.

Deliver scalar enable first. Add bus D-FF/register in the storage stage. Wider JK/T/SR variants require their own bitwise contract later; they are not prerequisites for scalar enable or 64-bit data wiring.

## 4. Width and channel-count contract

Distinguish data width, channel count and physical drawing size in the UI.

| Family | Planned support |
|---|---|
| IN/OUT, CONST, gates, MUX/DEMUX data | Integer width 1–64, with 8/16/32/64 presets. Gate input count remains separate. |
| Equality/magnitude comparators | Integer width 1–64, retaining bus/per-bit forms. Define signedness explicitly if adding signed magnitude comparison. |
| MUX/DEMUX channels | 2/4/8/16/32/64; derive select width. 64 channels require 6 select bits. |
| Encoder/decoder channels | 4/8/16/32/64; preserve encoding/priority/enable rules. 64 channels correspond to 6 code bits. |
| Bus Tap | Start bit 0–63 and slice width 1–64, bounded by the actual source. Accept ranges such as `63:32`. |
| New bus D-FF/register and data blocks | Width 1–64, with output widths and timing explicitly documented. |

Use bus pins for compact large-channel views; preserve legacy pin modes and preview a large per-bit symbol before placement.

Implementation requirements:

1. Update Inspector bounds and runtime clamps together, including import validation, width diagnostics and VHDL literals.
2. Use BigInt or exact string operations for full integer values above Number's safe range. Ordinary numbers remain suitable for bit indices and small counts.
3. Keep constants serialized as strings; do not store raw BigInt in JSON.
4. Keep scalar width 1 and vector widths above 1 consistent through ports, wires, nested subcircuits and VHDL.
5. Preserve existing defaults and saved parameters. New 64-bit features target the updated Studio; older builds may not support them.
6. Cover widths 1/5/12/16/31/32/33/53/54/63/64, especially upper bits and non-nibble-aligned constants.
7. Preview port deletion, wire removal, connected-width changes and value truncation. Apply/Cancel and one-step Undo must cover the entire change; retain compatible wires.

## 5. Faster wiring

### A. Continuous source connection

Choose an output or driven net once, then click multiple compatible destination inputs. Keep the source active until Esc or Finish. Reuse existing branching helpers. This is the smallest extension and a fallback when sweeping is inconvenient.

### B. Sweep connection

Add an explicit mode, separate from ordinary wiring and moving components:

1. Start from an output/driven net, for example `clk`, `rst` or `en`.
2. Drag across intended input port dots. Passing across a body or unrelated wire does not select it.
3. Highlight accepted destinations and preview branches during the drag. Count each destination once.
4. Show why an incompatible or occupied destination is skipped.
5. Release to apply the preview as one Undo action. Esc cancels without mutation.

Initial rule: one source to multiple inputs of matching width. Same-net targets are no-ops; inputs driven by another source are skipped, preserving their wires. Do not infer bit replication, bus slices, signal names or output-to-output joins.

Reuse the junction/fan-out representation and local route healing; preserve unrelated routes. Hit detection must handle zoom, rotation/mirroring and fast pointer movements crossing multiple ports between events.

### C. Connect selected components by port

Implemented in Stage 4: select components, choose the exact destination input ID such as `clk` or `en`, choose its source, then preview and apply. The table shows each accepted/skipped destination and its reason. This distributes control signals to 32/64 repeated blocks without sweeping every dot. Apply revalidates current targets and creates one Undo transaction; occupied inputs and same-source connections are preserved. Group branches share a junction and use local routing rather than repeatedly reorganizing the whole fan-out.

Pairwise wiring of independent signals is delivered in the editor follow-up below. Automatic Bus Tap allocation remains a separate later design. Distributing one signal remains distinct from mapping several signals to different destinations.

## 6. Editor usability — Stage 4 implemented

- CONST: Decimal/Hex/Binary entry with exact unsigned values through 64 bits, equivalent values and overflow feedback. Invalid or overflowing new entries do not commit; changing presentation base does not edit the model or add Undo history. Width reductions still use the existing truncation preview.
- Bus Tap: direct descending `high:low` or single-bit entry and split/merge mapping preview, bounded by the attached bus width. Apply changes start bit and slice width together; Cancel and one-step Undo preserve the previous range. Next-range, continuous placement and split/merge helpers remain available.
- Inspector: reuse existing parameter forms, distinguish channel/input counts from data width and show flip-flop enable/control priority.
- Components: gear buttons and an optional “ตั้งค่าก่อนวาง” checkbox open configuration before click/drop placement, with a symbol and port preview. Cancel leaves the model unchanged. Palette search includes primitives, custom VHDL blocks and eligible reusable subcircuits while excluding top/self/recursive references. Preferences are transient; existing project JSON stays compatible.
- Checks: structural diagnostics, VHDL simulation, synthesis and physical-board verification remain separate evidence.

### Stage 5E: easy component resizing — delivered 2026-10-10

The user requested completion of Phase 5, authorizing this previously plan-only editor stage. At that checkpoint, Stage 5E was complete and Stage 6 had not started; Stage 6 is delivered in the later section below.

- Coverage: every placeable component family, including gates, IN/OUT, constants, flip-flops, register boxes, MUX/DEMUX, encoder/decoder, comparators, Bus Tap, schematic/custom/VHDL boxes and Module Frame. Small point/marker symbols such as junctions need an appropriate size control rather than a forced rectangular box.
- Direct manipulation: show resize handles on a selected component so dragging an edge/corner makes it smaller or larger. Provide an aspect-ratio lock where appropriate, grid snapping and a minimum readable size that prevents pin/label overlap.
- Inspector: expose clearly labeled drawing width/height or scale, quick smaller/larger controls, size presets and Reset to default. Use the same settings in preplacement configuration, with a live symbol/port preview.
- Meaning: resizing changes only the selected instance's drawing geometry. It does not change data width, pin count, generic values, serial bit order, module source, internal circuit or generated VHDL. Changing a subcircuit box must not resize its internal components or other instances.
- Geometry: move symbol, ports, labels, hit targets, selection bounds and minimap bounds consistently. Respect existing rotation/mirroring and zoom; do not confuse component resizing with zooming the entire canvas. Retain port IDs and electrical connections.
- Wiring: preview moved pin endpoints and adjust only connected local wire segments after Apply. Preserve unrelated manual routes and junction topology, and retain layout-lock behavior. Define the local routing behavior before implementation.
- Transactions and persistence: a drag is one Undo action; Esc/Cancel restores exact geometry and wire paths. Inspector edits use preview and Apply/Cancel. Save/load and component packages retain each instance's size; older projects retain their original default geometry.
- Verification after implementation: cover each component family, rotated/mirrored parts, scalar and 64-bit ports, zoom/grid behavior, minimum size, connected wires, locked/manual routes, independent module instances, save/load and complete Undo/Redo. Confirm generated VHDL and net connectivity remain identical before and after a visual resize.

## 7. Hybrid VHDL + schematic workflow — Stages 5A–5B delivered

### A. Delivery forms and user workflow

| Form | Intended use |
|---|---|
| External configurable module pack | Import a category pack or an individual `.sccomp.json`, then choose its box from REUSABLE CIRCUITS, configure and wire it. The package retains friendly controls, input defaults, notes and source. |
| Imported VHDL module | Import a local `.vhd`/`.vhdl` file, review the selected entity and ports, then place it as a reusable box. The architecture stays as source code rather than being converted into gates. |
| Portable module package | Export the source, interface, defaults and required included dependencies together; import the package into another project. Reuse the existing custom-component package format where practical. |

The project stores a copy of imported source, rather than relying on an absolute path to the original file. Moving the project to an exam computer must retain its module implementations. Source inspection is optional for wiring; the Inspector still exposes the interface, settings and behavior notes.

Stage 5B delivered workflow: import one PIPO entity, place two instances, configure `WIDTH=8` and `WIDTH=64`, and connect each instance to matching schematic buses. Export emits the module definition once and separate generic/port mappings for the two instances.

### B. Stage 5A — fixed-interface VHDL module boxes (delivered)

1. Inspect the existing `customPorts`, `customTypeDef`, custom package import/export, project serialization and VHDL dependency/export paths. Extend these rather than introducing another parallel module system.
2. Add a distinct Import VHDL Module action with file selection, entity/interface preview, Apply/Cancel and one-step Undo. Retain Import VHDL as Schematic for users who want a drawn circuit.
3. Start with a clearly supported interface subset: `in`/`out` ports of `std_logic`, `std_logic_vector`, `unsigned` and `signed`, with fixed supported ranges and explicit type/direction/width. Preserve vector indexing and the difference between scalar and one-element vector. Unsupported interfaces must produce a specific error; do not guess their shape.
4. Treat the architecture as opaque source: preserve the VHDL body without requiring the schematic parser to understand its internal logic. A source successfully imported as a box is not automatically proven synthesizable.
5. Store the entity name, source, port signature and description with the module definition. Render named ports using existing bus wiring, diagnostics and palette search. Surface interface/source errors before placing a broken module.
6. Include required supplied VHDL dependencies in the project/package and export bundle. Detect missing dependencies and entity-name collisions; do not silently rename an entity while leaving its source/references unchanged.
7. Verify a complete mixed circuit: schematic gates and wires → imported VHDL box → schematic outputs. Export the top and every required included design unit, retaining the original module source.

### C. Stage 5B — configurable instances and interface changes (delivered)

1. Add per-instance generic values through the Inspector and the existing preplacement form. Start with integer/natural/positive generics and explicit bounds for the supplied module catalog; expand supported generic types only when a planned module requires them.
2. Resolve generic-dependent port ranges from defaults plus that instance's overrides. Support a documented subset of numeric expressions such as `WIDTH-1`; use bounded parsing rather than executing imported expressions. Reject unresolved, invalid or unsupported ranges before Apply.
3. Keep a shared module definition and independent instance values: changing the 8-bit instance must not alter the 64-bit instance or rewrite the VHDL body. Generate a matching `generic map` and typed `port map` for each instance.
4. Reuse parameter-change preview for changing generics or replacing module source/interface: show affected port types, widths, names and connected wires before Apply. Preserve compatible connections; Cancel changes nothing and Undo restores the entire transaction.
5. Preserve old schematic-based and fixed-interface custom modules. Save/load, package import/export, Schematic Text and AI catalog must describe the actual configured ports and parameter values consistently.
6. Retain the editor's current 1–64-bit data-width contract initially. Handle wider products/BCD outputs only after explicitly choosing wider-bus or split-port interfaces; do not silently truncate them.

Acceptance checks: preview/import Cancel has no model changes; module/source and settings survive save/load and transfer to another project; unsupported declarations and missing dependencies fail clearly; one entity can serve 8-bit and 64-bit instances with independent settings; parameter/source updates have complete Undo/Redo; GHDL compiles and simulates the exported mixed circuit. Browser checks cover placement and interface previews. Vivado synthesis and physical-board results remain separate checks.

## 8. Configurable blocks after hybrid module foundations

Deliver the following common blocks as external import files using the hybrid module support. Users choose individual files or category packs, then configure and connect imported boxes in Components. Future counters/timing, arithmetic and display packs follow this distribution. Existing primitive gates and schematic subcircuits remain available for composition.

### External-file delivery revision — authorized 2026-10-10

This revision supersedes the built-in delivery described in the historical Stage 5C/5D records below; the module hardware contracts are unchanged.

1. Extract the eight existing register/input-conditioning definitions without rewriting their working VHDL. Supply one `.sccomp.json` per module, category packs and matching editable `.vhd` files.
2. Remove the hardcoded source factories and automatic `LIB:*` palette entries. Imported modules appear in REUSABLE CIRCUITS and use the existing `CUSTOM:*` path. No automatic installation or network fetch is required.
3. Preserve embedded sources, defaults, friendly generic controls, Debounce milliseconds conversion and diagnostics in old projects and imported packages. Retain existing source replacement, generic previews and Undo/Redo.
4. Schematic Text references imported `CUSTOM:*` definitions after package import; old transient `LIB:*` text references must be changed. Existing saved projects already contain ordinary `CUSTOM:*` instances and require no migration.
5. Keep package import collision behavior: importing an already-present entity is rejected without overwriting it. Use Change source for an intentional update. Raw `.vhd` import preserves source and generics but does not carry Studio-specific package defaults or friendly metadata.
6. Verify empty-project palettes, actual file import, independent widths/settings, old-project reopening, portable export, collision safety, time conversion and the existing simulation/synthesis checks against the delivered files.

At the delivery-migration checkpoint, Stage 5E was still plan-only. The later request to finish Phase 5 authorizes Stage 5E; Stages 6–9 remain future module-pack work.

### A. Original catalog with added capabilities

| Order | Block | Required customization |
|---|---|---|
| 1 | Bus D-FF / PIPO register | Width, enable, clock edge, sync/async reset and reset value; reset wins over enable. |
| 2 | SIPO / PISO / SISO and Universal Shift Register | Width, direction, serial bit order, enable and reset. Universal mode selects hold / shift-left / shift-right / parallel-load; define control precedence. |
| 3 | Synchronous up/down counter | Width, start/end, direction, load, enable, reset, wrap/stop, terminal indication and out-of-range loads. |
| 4 | Counter with skipped values | Separate block; decide step size versus excluded numbers/custom sequence before implementing. |
| 5 | Clock divider / tick generator | Input frequency, target rate/divisor, enable/reset; distinguish single-cycle tick from divided clock and show achievable rate/duty cycle. |
| 6 | Arithmetic / bit operations | +/−/×/÷/remainder, negate, absolute value, signedness, result widths, zero/carry/borrow/signed-overflow flags, shifts/rotates, reduction AND/OR/XOR and parity. Define divide-by-zero, minimum signed absolute-value behavior and combinational/multi-cycle latency. |
| 7 | BIN↔BCD | Binary width, digit count, validity/overflow and latency. Four bits per digit may require outputs wider than 64. |
| 8 | Seven-segment | Decimal/HEX/raw patterns, independent digits, blank/decimal point, scanning and polarity. |
| 9 | LCD 16×2 | Fixed/dynamic characters and values per position; separate formatting from the working display transport. |
| 10 | SPI ADC reuse | Raw sample and sample-valid interface around working lab logic; compose formatting/display separately. |

A full 64×64 multiplication product is 128 bits; twenty BCD digits use 80 bits. Decide wider-bus or split-port interfaces before implementing such blocks. Do not silently truncate to 64. Requested divider rates may require approximation; do not promise every frequency exactly.

### B. Additional basic modules

| Priority | Block | Required customization / behavior |
|---|---|---|
| 1 | Input Synchronizer | Configurable sampling stages and reset value for an external single-bit level; document latency. Independent bit synchronizers do not guarantee coherent multi-bit data capture, and short pulses need a separate transfer design. |
| 2 | Debounce | Configurable stable interval in cycles or time, source clock frequency and active polarity. Output stable level plus press/release events; define startup/reset behavior. |
| 3 | Edge Detector | Rising/falling/both-edge detection; one-clock output event in the receiving clock domain. Define reset history to avoid unintended startup events. |
| 4 | Timer / Delay / One-shot | Configurable duration, start/cancel/restart, busy/done and timed pulse. Define zero duration, completion pulse width, retrigger policy and command precedence. |
| 5 | Bus utilities | Slice, concatenate, reverse bit order, zero-extension, sign-extension and explicit truncation. Show input/output widths and mapping; reuse existing Bus Tap functionality where it fits. |
| 6 | Lookup Table / ROM | Address width, entry count, data width, editable values and invalid-address behavior. Specify combinational or clocked read timing; start with a simple editable table, without a general memory subsystem. |
| 7 | PWM | Configurable period/duty, enable/reset and output polarity. Define 0%/100% endpoints, parameter-update timing and behavior when duty exceeds period. |

Compose these blocks using a shared clock and event/enable signals where practical. The user's unchanged lab clock schemes remain accepted.

### C. Extensions to existing primitives

- Comparators: explicit signed/unsigned magnitude comparison plus reusable range-check, clamp and min/max blocks or schematic templates. Specify inclusive/exclusive bounds and behavior for invalid bounds.
- Encoder: expose valid and document priority, so no asserted input is distinguishable from input index 0. Preserve existing behavior for legacy instances; specify multiple-input handling.
- Use existing MUX/DEMUX, decoder, comparator and Bus Tap implementations as foundations; add configuration or small compositions rather than duplicating their functionality.

### D. Frequently used larger compositions

| Block | Composition and intended use |
|---|---|
| Button Input | Synchronizer → debounce → edge events in one convenient block. Expose stable level and press/release pulses, with the same parameters as the underlying modules. |
| Number Formatter | Share BIN/BCD/HEX/ASCII formatting across LCD and seven-segment. Configure signed display, digit count, leading zeros/spaces and fixed decimal-point position; define overflow display and formatting latency. Keep formatting separate from physical display drivers. |
| ALU | Compose arithmetic/bit-operation modules with an operation selector and flags; useful for mini-calculator/basic CPU labs. Document which operations are available and their result-valid/latency contracts. |
| Sequence Controller / FSM template | Editable state register, transition conditions, per-state outputs and reset state; useful for modes, LED sequences and peripheral control. Define event priority and invalid-state recovery. Start with an inspectable schematic template rather than a new programming language. |
| MM:SS Timer | Compose bounded minute/second counters, tick and control logic; start/pause/reset/load, count direction and completion. Expose time digits and status so seven-segment/LCD can be selected separately. |

Build these compositions after their dependencies. Keep the basic modules independently available; selecting a large block should not be required to use a small operation.

## 9. Delivery order and acceptance checks

| Stage | Work | Verification after implementation |
|---|---|---|
| 1 | Parameter-change preview and scalar D/JK/T/SR enable | Enabled transitions, hold, clock edge, async controls while disabled, legacy defaults and complete Undo. |
| 2 | Exact constants, 1–64-bit support, 32/64 channel options | Upper-bit/odd-width values, comparator boundaries, select/code widths, Bus Tap split/merge, save/load and VHDL compile/simulation. |
| 3 | Continuous source and sweep wiring | Multi-target connections, duplicates, occupied/wrong-width ports, cancel, Undo/Redo, zoom/rotation and route preservation. |
| 4 | Group port connections and remaining Inspector/palette work | Explicit mapping preview, number-base conversion, ranges and placement configuration. |
| 5A — delivered | Fixed-interface VHDL module boxes: import → port preview → placement → portable export | Source preservation, explicit port types/indexing, mixed schematic/VHDL wiring, dependencies/name collisions, Cancel/Undo and GHDL compile/simulation. |
| 5B — delivered | Per-instance generics and configurable port interfaces | One shared entity instantiated at 8/64 bits, independent settings, range/type validation, generic/port mappings, impact preview, save/load and complete Undo/Redo. |
| 5C — delivered; distribution migrated | External register pack: bus D-FF/PIPO → SIPO/PISO/SISO → Universal Shift Register | Width boundaries, reset value, selected clock edge, load/hold/shift precedence, serial direction/order and simulation of multiple configured instances. |
| 5D — delivered; distribution migrated | External input-conditioning pack: Synchronizer → Debounce → Edge Detector | Sampling latency, stable input/debounce thresholds, one event per edge and reset/startup behavior. |
| 5E — delivered | Easy visual resizing of every component: drag handles, Inspector size controls, presets and Reset to default | Type-appropriate geometry, readable pins/labels, connected local wire updates, rotation/mirroring, independent instances, save/load and Undo/Redo; unchanged connectivity and generated VHDL. |
| 6 — complete | Counters / divider → Timer → Bus utilities → LUT/ROM → PWM | Timing boundaries, cancel/retrigger, exact bit mapping, table addressing/read latency and PWM endpoints. |
| 7 — complete | Arithmetic / comparison / encoder extensions → BIN↔BCD → Number Formatter | Signed boundaries, flags, range/clamp, encoder valid/priority, reduction/parity, conversions and overflow display. |
| 8 — complete | Seven-segment → LCD → ADC composition | New interfaces and integration, accepting unchanged lab internals as working. |
| 9 — complete | Button Input / ALU / FSM template / MM:SS Timer | Integrate already checked foundations; verify control priority, state transitions, result timing and parent-facing interfaces. |

Before each stage, make a short concrete design of UI, ports, behavior and affected functions. Implement only after the user requests it. Run focused existing tests/browser checks for changed behavior; expand regression checks when shared width/routing/generation code changes. Physical-board evidence is separate from browser or simulation results.

Stage 1 delivery: optional enable for all four scalar flip-flops, generated component reference, and a parameter-change preview with Apply/Cancel/Escape and one-step Undo. Parent IN/OUT rename mapping is preserved.

Verification: application regression tests, GHDL compilation/simulation for enabled/disabled flip-flops on both clock edges, legacy/import/save-load checks, and browser checks for enable placement and preview Cancel/Escape/Apply/Undo. No Vivado synthesis or physical-board check was performed. Supplied lab projects were unchanged.

Stage 2 delivery: widths 1–64 and presets; 32/64 channel choices; exact CONST binary conversion; Bus Tap upper-bit support; compact bus forms for new large encoder/decoder choices; parent-sheet width previews; and staged JSON/text validation of supported dimensions. Bus DEMUX uses one vector assignment per channel to keep 64-channel wide designs practical to compile. Existing channel choices retain their symbol geometry and defaults.

Stage 2 verification: 152 application tests passed with zero failures/skips, including GHDL compilation/simulation of the width boundary matrix, all 32/64 MUX/DEMUX channels, encoder/decoder priority and enable, bus/per-bit comparison, high-bit split/merge, nested 64-bit interfaces, JSON round trips and atomic rejection of unsupported dimensions. Browser checks covered width presets, exact truncation preview, Cancel/Apply/Undo, new channel choices and compact bus symbols. No Vivado synthesis or physical-board check was performed.

Stage 3 delivery: two explicit toolbar tools — Continuous Source (7) and Sweep (8). Choose a real output or a driven wire/junction; source remains armed between clicks or gestures. Continuous mode connects one input per click. Sweep detects input dots along each pointer segment, including rotated/mirrored symbols and zoom, deduplicates hits, previews accepted/skipped targets and branch guides, then applies one Undo transaction on release. Esc cancels an active gesture without editing the sheet and keeps the source; Esc outside a gesture, Enter or Finish ends the tool. Wheel/pan, window blur, tool/sheet/project switches and Undo discard transient previews. Sources/previews are never serialized.

Matching widths only, including 32/64-bit buses. Inputs with existing wires are skipped; same-source targets are no-ops. No inferred bit replication, slicing or port-name matching. Sweeping across another compatible input dot intentionally includes it; the user must follow the highlighted dots and steer around unwanted inputs. Branches reuse the existing net/junction representation and chosen wire anchor. Route healing now honors its supplied scope when cleaning junctions, preserving unrelated manual routes and pass-through/orphan junctions; ordinary global cleanup retains its prior behavior.

Stage 3 verification: 168 application tests passed with zero failures/skips, including 16 new tests for continuous/sweep wiring, exact widths, occupied/undriven inputs, deduplication, preview/cancel with no model or id changes, atomic Undo/Redo, orientation/zoom, source anchors, locked/manual routes, unrelated topology, lifecycle and serialization. GHDL compiled and simulated swept clock/reset/enable/data connections to four flip-flops. Browser checks verified repeated clicks, a sweep accepting three inputs while skipping an occupied input and a 32-bit input, one-step Undo/Redo and Finish/Esc. No Vivado synthesis or physical-board check was performed. Supplied lab projects remain unchanged.

Stage 4 delivery: selected-component group connections with explicit input IDs and accepted/skipped mapping; exact Decimal/Hex/Binary CONST widgets; atomic Bus Tap range editing; shared parameter forms, optional configuration before placement, symbol/port previews and palette search across primitives and reusable circuits. Large group connections share a junction and retain unrelated routes, locked component positions and an explicitly chosen source anchor. Existing quick placement remains available when preconfiguration is disabled.

Stage 4 verification: 186 application tests passed with zero failures/skips, including 18 new tests for exact 64-bit values, overflow/invalid formats, hex JSON compatibility, atomic ranges and Undo/Redo, 64-target groups at 1/32/64 bits, exact port IDs, occupied/missing/stale targets, unrelated routes/locked positions/anchors, configured placement and reusable-circuit search. GHDL compiled and simulated a high-bit slice, the unsigned 64-bit maximum and 32 enabled flip-flops with grouped clock/data/enable/reset. Browser checks covered group preview/Apply/Undo/Redo, CONST bases and overflow/Cancel, Bus Tap preview/Cancel/Apply/Undo/Redo, synchronized range fields before placement and reusable-circuit search. No Vivado synthesis or physical-board check was performed. Supplied lab projects remain unchanged.

Stage 5A delivery: Tools → Import VHDL Module accepts pasted source or multiple `.vhd`/`.vhdl` files. Preview shows exact port names, directions, native types and fixed ranges (1–64 bits). Apply adds reusable boxes to Components; the Inspector exposes ports, optional collapsed source and Export module package. Projects and component packages embed original source and supplied package dependencies. Mixed schematic/VHDL generation preserves native signed/unsigned/vector types and indexing through typed adapters. Missing dependencies, name collisions, unsupported interfaces and inconsistent saved metadata are rejected before project mutation. The original Import VHDL as Schematic workflow remains available.

Supported import boundary: one entity and one matching architecture per entity file; `in`/`out` ports using `std_logic`, `std_logic_vector`, `unsigned` or `signed`, with fixed numeric ranges. Package files may contain multiple declarations and bodies, but a package body must accompany its declaration in the same file. Architecture source is preserved rather than compiled by the importer. Generics, `inout`, unconstrained/custom port types and foreign-library dependencies are outside Stage 5A.

Verification: `node --test schematic2vhdl/*.test.js` passed 207/207, with no skips, including 21 new module tests and GHDL compilation/simulation of typed adapters, packages/dependencies and a register with enable/reset. Browser checks covered paste and multiple-file import, invalid-interface/name feedback, Apply/Cancel, Undo/Redo, reload persistence, a mixed circuit with six components/five wires, generated VHDL, optional source inspection and actual component-package download. Browser console had no warnings/errors. An older unrelated QA sheet still has an unconnected-output diagnostic; this is not a claim that every pre-existing sheet passes Check. No Vivado synthesis, physical-board validation or changes to supplied lab logic were performed.

Stage 5B delivery: integer/natural/positive generics with required defaults and optional ascending integer subtype bounds appear as independent fields in the Inspector and preplacement form. Absent overrides retain VHDL defaults, including defaults that depend on earlier generics. Port ranges resolve per instance while each module retains one original source definition. Export emits a shared generic component declaration, per-instance generic maps and native typed port adapters. Generic edits preview exact resulting port types/ranges and affected wires before Apply, retain existing connections for width diagnostics, and have one-step Undo/Redo. The module details view shows the selected instance's actual generic values and port types.

Source replacement: module details → Change source accepts a complete replacement entity/architecture with the exact original entity name and dependencies already included in the project. Preview covers all instances in project sheets and stored schematic customs, original/new ports, individual affected wires and removed generic overrides. Removed or reversed ports detach their wires; other changed port wires remain for width/type review. Invalid retained settings, unresolved dependencies and stale previews are rejected before mutation. Apply updates the shared source and instance interfaces as one undoable transaction. Additional dependency-file replacement remains a separate import/edit operation.

Expression boundary: decimal and integer based literals (bases 2–16), previously declared generic names, parentheses, unary signs, `+`, `-`, `*`, integer `/`, `mod`, `rem` and `**` with exponent 0–31. Parsing is bounded to 512 characters, 128 tokens and 32 nesting levels; no imported expressions are executed. Generic values remain within the portable signed 32-bit integer range and declared subtype bounds; vector indices are nonnegative, with resolved widths 1–64 bits. Functions, package constants, attributes, real/boolean/string/type generics, unconstrained/custom port types and `inout` remain unsupported interface declarations. Architecture logic stays opaque and unchanged.

Persistence and authoring: project save/load and mixed component packages retain per-instance overrides; saved instance values and metadata are revalidated. Schematic Text uses fields such as `generic_WIDTH=64`; its catalog exposes generic declarations/defaults/bounds and native default port types, and signatures detect generic-interface drift. Older schematic and fixed-interface custom modules keep their existing behavior.

Stage 5B verification: the full Node suite passed 221/221 with no skips, including 14 new generic tests. GHDL compiled/simulated independent 8/64-bit instances, native signed/unsigned mappings, ascending/nonzero and single-element vectors, dependent defaults, negative generic values and a generic-only entity with no ports. Transaction checks cover invalid/stale settings, save/load, mixed packages, shared source replacement and complete Undo/Redo. Browser checks covered import, Schematic Text instances, Inspector impact Apply/Cancel, Undo, reopened workspace persistence, selected-instance port details, source replacement across both instances and restoration of detached wires, preplacement 64-bit preview, rejection of WIDTH=65, and generated 8/64 generic maps. The earlier unrelated QA sheet's unconnected-output diagnostic remains; no all-sheets Check or Vivado/board success is claimed.

Stage 5C delivery: Components → REGISTERS contains PIPO / Bus D-FF, SIPO, PISO, SISO and Universal Shift Register. Configure WIDTH=1–64, rising/falling clock edge and synchronous/asynchronous active-high reset in the Inspector or before placement. Each box uses the existing VHDL module infrastructure; source is embedded on first placement and shared by independently configured instances. Projects and portable packages retain source, generic settings and explicit default inputs. Placement/import and parameter changes retain their existing Apply/Cancel and Undo/Redo behavior.

Register interface and precedence:

| Block | Data ports and operation |
|---|---|
| All five | `clk`, `en`, `rst`, `reset_value[WIDTH]`; reset takes priority over enable, and `en=0` holds state. Unconnected `en=1`, `rst=0`, `reset_value=0`; clock must be connected. Initial state is zero. |
| PIPO / Bus D-FF | `d[WIDTH]` → `q[WIDTH]` at the enabled selected clock edge. |
| SIPO | `si` → `q[WIDTH]`; configurable left/MSB-first or right/LSB-first input sequence. |
| PISO | `d[WIDTH]`, `load`, `si` → `q[WIDTH]`, `so`; enabled parallel load takes priority over shifting. `so` is the current MSB when shifting left, or LSB when shifting right. Read it before the next shift edge. |
| SISO | `si` → `so` through WIDTH storage bits; same configurable direction and serial order as PISO. |
| Universal | `d[WIDTH]`, `mode[2]`, `si_left`, `si_right` → `q[WIDTH]`, `so_left` (current MSB), `so_right` (current LSB). `00` hold, `01` shift left, `10` shift right, `11` parallel load. |

Unused serial inputs and PISO load default to zero; unused Universal mode defaults to hold. These are explicit register defaults, not missing-driver fallbacks. A connected dangling wire still receives the existing diagnostic. Ordinary imported modules without default-input metadata keep their existing behavior.

Reset value is a schematic bus, preserving exact 64-bit values: connect a matching-width CONST to `reset_value`. Asynchronous reset requires CONST/GND/VCC or the unconnected zero default; a runtime-varying reset value requires synchronous reset. Check and Schematic Text import reject dynamic asynchronous reset values. Export emits static generate branches for each clock/reset combination so synthesis sees one selected edge per process.

Schematic Text can use built-ins without first importing a package: `use "LIB:SIPO" as shiftreg`, then `part reg @shiftreg generic_WIDTH=64 generic_DIR_RIGHT=1`. Preview is pure; import embeds source and stores ordinary `CUSTOM` instances as one Undo transaction. Existing name/source collisions fail explicitly.

Stage 5C verification: 37 focused tests passed with no skips. The full suite passed 258/258 with no skips using `node --test --test-concurrency=1 schematic2vhdl/*.test.js`; the initial concurrent run had one GHDL analysis timeout in an older 64-channel test, which passed in the serial rerun. GHDL compiled/simulated all five families at 1/8/64 bits, both serial directions, hold/load/mode/reset priority, exact upper-bit reset values and selected clock edges. GHDL synthesized all five 64-bit families with asynchronous reset and falling edge. Browser checks covered 64-bit preplacement controls, placement Undo/Redo, Schematic Text import of PIPO 8-bit and SIPO 64-bit boxes, generated mappings/defaults, reload persistence and Inspector settings; console had no warnings/errors. Built-in symbols use short titles to avoid overlapping pin labels; the catalog test passed again after this visual adjustment. The older unrelated QA sheet's unconnected-output diagnostic remains. No Vivado synthesis, physical-board validation or changes to supplied lab logic were performed.

Stage 5D delivered contract:

- Add an INPUT CONDITIONING palette group through the existing built-in/custom VHDL path. Reuse independent generics, embedded source, source-once export, Schematic Text, parameter previews and portable packages; do not introduce a second module system.
- All three blocks use a continuously running rising-edge clock and synchronous active-high reset, with unconnected reset defaulting to zero. No gated clock or enable is added to the synchronizer chain.
- Input Synchronizer (`LIB:SYNC`): `clk`, `rst`, external one-bit `d` → `q`; STAGES=2–64 (default 2), RESET_LEVEL=0/1 (default 0). Data propagates through STAGES sampling edges. Initialize/reset every stage to RESET_LEVEL and mark the chain with the Vivado ASYNC_REG attribute. This is a single-bit level transfer; simulation does not model metastability or establish physical CDC correctness, and short pulses or coherent buses require another transfer design.
- Debounce (`LIB:DEBOUNCE`): synchronized `d` plus `clk`, `rst` → stable logical `q`, one-clock `pressed` and `released`. ACTIVE_LOW=0/1 defines input polarity; q=1 always means active/pressed. Require STABLE_CYCLES=1–2147483647 consecutive samples opposite to q before changing q. Default 500000 cycles at CLOCK_HZ=50000000 means 10 ms. A return to the current level clears the count. Reset/initial state is inactive with no events; an input held active after reset generates pressed only after the full stable interval. Provide a milliseconds-to-cycles helper in preplacement and Inspector, rounding up exactly, and show the actual period. CLOCK_HZ describes the actual connected clock; it does not create or measure a clock.
- Edge Detector (`LIB:EDGE`): synchronized `d` plus `clk`, `rst` → `rise`, `fall`, selected `pulse`. MODE=0 rising / 1 falling / 2 both, default rising. Rise/fall always describe their respective transitions; MODE selects pulse. Clear pulses each clock, capture the first post-reset sample without an event, then detect later transitions. A one-clock event can remain high on consecutive selected transitions in both-edge mode.
- Recommended composition: external input → Synchronizer → Debounce → Edge Detector, all on the same clock/reset. Set Synchronizer RESET_LEVEL equal to Debounce ACTIVE_LOW so the chain initializes to the physical inactive input level; this avoids a false startup press when the debounce interval is shorter than the synchronizer latency. Debounce already provides press/release events; Edge Detector is independently usable for other synchronous levels.
- The milliseconds helper requires an explicit Convert action and uses the existing generic preview/Apply/Cancel transaction. Time input is decimal (up to nine fractional digits); conversion uses exact integer arithmetic and rounds up. The saved/hardware setting is STABLE_CYCLES, and the actual duration is shown from STABLE_CYCLES/CLOCK_HZ. Other independent instances retain their settings.

The synchronizer's ASYNC_REG attribute follows the [AMD Vivado CDC synchronizer guidance](https://docs.amd.com/r/2024.2-English/ug903-vivado-using-constraints/CDC-Synchronizers-and-ASYNC_REG-Property). Source preservation and successful digital simulation do not establish physical metastability performance or replace CDC/timing checks on a target implementation.

Stage 5D verification: the serial regression run passed 290/290 with no skips, including the initial 32 input-conditioning tests. A matching-reset active-low startup case was then added; the final focused suite passed 33/33 with no skips. GHDL compiled/simulated STAGES=2/3/64 with reset levels 0/1, exact debounce thresholds of 1/2/3/5 clocks for both polarities, counter restart on bounce, held-active startup, synchronous reset, all three edge modes, first-sample suppression and consecutive both-edge events. The maximum debounce count was checked for early-state/overflow behavior over a short simulation and synthesized; a full 2147483647-clock elapsed interval was not simulated. All three module families passed GHDL synthesis at boundary settings, and the complete three-box composition was simulated, including active-low idle startup with a one-clock debounce interval and a matching synchronizer reset level.

Browser verification: input palette and preplacement preview, 20 ms → 1000000 clocks at 50 MHz, active-low selection, invalid zero-time feedback, Cancel without placement, Schematic Text composition, Inspector 15 ms → 750000 preview/Cancel/Apply, Undo/Redo, RESET_LEVEL=1 and MODE=2 mappings, original source-once exports and reload persistence. Console had no warnings/errors. The older QA sheet `group_demo` still reports its unconnected OUTPUT `wide`; the new composition has no corresponding Check error. No Vivado synthesis/implementation, physical-board/CDC validation, supplied-lab changes or Stage 5E resize implementation was performed.

External-file delivery migration is complete. Its original next stage was Stage 5E component resizing, subsequently authorized by the request to finish Phase 5. External module packs for Stages 6–9 still require separate implementation requests.

## External-file delivery migration — delivered 2026-10-10

- `fpga-exam-kit/modules/` contains eight individual `.sccomp.json` packages, two category packs and eight identical editable `.vhd` sources, with a usage/update guide. Studio no longer embeds the source factories or auto-installs `LIB:*` modules; imported and existing boxes are visible under REUSABLE CIRCUITS.
- Tools → Import Component Package exposes the existing package path. Multi-file installation is staged atomically with one Undo; collisions retain existing definitions. The file input is attached to the page until selection/cancellation and removed afterward, allowing browser file selection to complete.
- Existing `libraryId` metadata still provides friendly controls, Debounce milliseconds conversion, usage notes and register/clock diagnostics for imported packs and older saved boxes. This metadata does not install definitions. Existing projects preserve their embedded sources/settings; raw VHDL import remains available.
- The full serial regression suite passed 303/303 with no skips, including module-file tests and the register/input-conditioning GHDL simulations/synthesis using the delivered category packs. After the file-picker attachment adjustment, the final focused file-delivery suite passed 13/13, including the real selection handler and cancellation cleanup. The full suite was not repeated for that isolated UI adjustment. `git diff --check` passed.
- Browser verification imported both actual category-pack files together (eight modules), displayed all eight in REUSABLE CIRCUITS, converted 15 ms to 750000 clocks at 50 MHz before placement and retained active-low settings in Inspector. Browser console had no warnings/errors. Proof: `/private/tmp/schematic-external-module-packs.png`. No Vivado or physical-board validation was performed. Stage 5E resizing was still plan-only at this migration checkpoint.

### Stage 5E implementation checkpoint — completed

1. Reuse the component type/geometry path, retaining legacy default sizes. Store drawing dimensions independently of width, channel count, generics and source. Point markers resize around their unchanged electrical anchor.
2. Add shared Inspector/preplacement fields, smaller/larger presets, aspect-ratio option and Reset to default. Inspector uses a preview with Apply/Cancel. Keep legacy sub-schematic geometry readable through the same controls.
3. Add edge/corner drag previews at the active zoom/orientation. Opposite anchors stay fixed, dimensions snap to grid, Esc/blur cancels and release commits one Undo. Layout lock and Placement Mode block resize edits.
4. Update only the resized instance and incident route endpoints; preserve interior manual waypoints where possible, unrelated drawn routes and junction topology. Freeze adjacent legacy-junction branches only if their derived exit axis would otherwise change the existing drawn route. Keep fonts/strokes readable, update bounds/hit areas/minimap and enforce type-appropriate limits.
5. Verify component families, 1/64-bit and dense ports, rotations/mirrors, lock/cancel/stale previews, save/load/packages and Undo/Redo, with byte-identical generated VHDL and unchanged net connectivity. Run focused checks, browser smoke and the serial regression suite.


### Stage 5E delivery and verification — 2026-10-10

- Drawing dimensions and aspect lock are per-instance parameters, independent of data width, channel count, generics and module source. All stock component families, imported VHDL/custom boxes, sub-schematics and documentation frames share the existing type/geometry path. Junction diameter changes retain the exact electrical anchor. Old dimensions/defaults still load, and Reset removes visual overrides without changing functional settings.
- Select one component and drag an edge/corner; Shift or “คงสัดส่วน” retains its proportions. Handles stay clear of the ports and keep their screen size at different zoom levels. Rotated/mirrored dragging preserves the opposite anchor. A drag previews without editing the model and commits one Undo on release; Escape/window blur cancels. Layout lock and Placement Mode block resize edits.
- Inspector “ขนาดภาพ” supports width/height, smaller/larger, 75/100/150/200% and Reset. Preview shows old/new geometry, connected routes and neighboring endpoints before Apply/Cancel. The same controls work in configuration before placement, refresh when channel counts change and block invalid dimensions. Minimum sizes retain legacy defaults while limiting further label/pin compression; strokes/fonts do not stretch with the artwork. Bounds, hit targets and minimap follow the resized/oriented geometry.
- Only incident route endpoints move. Interior manual routes and unrelated paths remain intact. For older junctions without a stamped axis, preserve an adjacent branch's existing drawn path if moving a neighboring pin would otherwise change its derived exit axis. No junction welding or global layout healing runs during resize.
- Persistence/transactions: dimensions survive project save/load; existing custom-package serialization retains nested instance parameters. Imported module source, port IDs, widths, generics and internal schematics stay intact. Resize tests confirm independent instances, stale-preview rejection, topology preservation, Cancel and full Undo/Redo, and byte-identical generated VHDL for a connected 64-bit circuit.
- Verification: `node --test --test-concurrency=1 --test-reporter=tap schematic2vhdl/*.test.js` passed **351/351**, with zero failures/skips, including **47 resize tests** and the existing GHDL checks. `git diff --check` passed. Final regression log: `/private/tmp/phase5e-full-verified.txt`.
- Browser verification: real mouse dragging at 62% zoom, rotation/mirroring, 200% preset, Cancel/Apply, Reset, Escape, Undo/Redo, reload persistence, layout-lock handles, 16-channel/64-bit MUX preplacement preview, invalid-size blocking and legacy VCC default placement. Console had zero warnings/errors. Proof: `/private/tmp/schematic-phase5e-resize.png`.

Phase 5 is complete. Next planned work is Stage 6 external configurable module files; implementation requires a separate user request. No Git mutations, deployment, Vivado build or physical-board validation were performed in this stage.


### Stage 6 implementation — authorized 2026-10-10

Deliver external category/individual `.sccomp.json` files and matching editable VHDL, without installing source factories in the editor. Implement counters and timing first, then bus utilities, editable ROM and PWM. All sequential blocks use the rising edge of the user's shared 50 MHz clock and synchronous active-high reset.

- Counter: WIDTH 1–64, inclusive runtime unsigned minimum/maximum and load_value, down/en/load/rst, wrap/stop selection, q/valid/terminal/wrapped. Reset wins over load, which wins over enable; reset selects minimum when counting up and maximum when counting down. Clamp loads and recover an out-of-range current value on an enabled edge; invalid bounds do not count.
- Skipped-value counter: separate definition. The user selected explicitly excluded numbers, such as 3 and 7. Four WIDTH-bit runtime skip slots, SKIP_COUNT=0–4, directional reset/load searches, wrap/stop and q/valid/wrapped/blocked; duplicates and out-of-range exclusions are harmless. No allowed result holds q and asserts blocked; reset on an entirely excluded range selects the directional bound and reports invalid/blocked. More than four slots is a future source/interface extension, not part of this delivery.
- Tick: integer DIVISOR 1–2147483647; one event every DIVISOR enabled edges. Divider: DIVISOR 2–2147483647 with low=ceil(D/2), high=floor(D/2), divided clock plus period tick; reset starts low. Report Fclk/D and odd-divisor duty rather than promising arbitrary exact frequencies.
- Timer/Delay/One-shot: duration bus WIDTH 1–64, start/cancel/en/rst, retrigger option, busy/done/pulse/remaining. Start captures duration; completion occurs after that many subsequent enabled edges. Zero duration completes on the start edge with no active interval. Reset > cancel > accepted start > enabled progress; done is one source-clock cycle, pulse is the active interval.
- Bus utilities: explicit Slice, Concat, Reverse, Zero Extend, Sign Extend and Truncate definitions; generic bounds reject impossible mappings. Combined bus widths remain at most 64, and truncation is explicit with a discarded-bit indicator.
- LUT/ROM: editable 64-entry source table, DATA_WIDTH 1–64, ADDR_WIDTH 1–6, entry count and combinational/clocked read. Invalid or unknown addresses return zero with valid=0. Reject table values that do not fit DATA_WIDTH rather than silently truncating.
- PWM: runtime unsigned period/duty WIDTH 1–64; duty clamps to period. Capture settings initially and at period boundaries, with optional force-load/restart. Period zero and disable drive the inactive level; enable pauses phase, reset clears state. Polarity is configurable; verify 0%/100% and setting-update timing.

Verification: import/interface/defaults/persistence/Undo checks, GHDL simulation of boundary/priority/timing/mapping cases including 64-bit values, GHDL synthesis of representative configurations and composed Schematic Text export. Extend only shared notes/clock diagnostics needed by the supplied files; preserve the existing eight source files and all unrelated editor behavior.

Delivered thirteen editable VHDL definitions with exact matching individual component packages, plus `modules/packs/timing.sccomp.json` (six), `modules/packs/bus.sccomp.json` (six) and `modules/packs/lookup.sccomp.json` (one). The editor does not preinstall them or embed their source. Shared editor changes add friendly timing/ROM choices, required-clock diagnostics and preserve library notes/clock metadata when replacing VHDL source. Existing registers/input-conditioning definitions remain intact.

Local regression: **415/415 passed**, including the initial **64 Phase 6 tests**. The subsequent **two downloadable-example tests also passed**, covering the decimal 10–88 timed count and fully wired raw-VHDL 64-bit counter excluding 3/7. Browser smoke: paste/import actual skip-counter VHDL, preview/apply 32→64-bit ports, import the example, verify WIDTH=64/SKIP_COUNT=2, select it as Top entity and generate two entities with synthesis-check success. The exact browser-generated bundle also compiled and synthesized with GHDL. Screenshot: `/private/tmp/schematic-phase6-modules.png`.

Usage and limits: `modules/PHASE6.md`; ready-to-paste examples under `modules/examples/phase6-*.schtxt`; downloadable `modules/downloads/phase6-modules.zip` contains category packs, individual VHDL/packages, notes and examples. Division is by integer D; divider odd periods have unequal duty; the skip list has four slots; ROM has at most 64 entries; no Vivado timing or physical-board validation was performed.

Phase 6 is complete. Next is Stage 7 arithmetic, comparisons, encoders, BIN↔BCD and value formatting, delivered as external module files. Stage 8 covers displays/LCD/ADC; Stage 9 covers composed lab/exam examples. No implementation of Stages 7–9, Git mutation or deployment in this stage.

### Module folder organization — 2026-10-10

All supplied modules and their associated packs, examples and ZIP downloads are grouped under `fpga-exam-kit/modules/`. Individual VHDL/package pairs remain in `registers/`, `input-conditioning/`, `timing/`, `bus/` and `lookup/`; category bundles are in `packs/`, Schematic Text examples in `examples/` and ZIP files in `downloads/`. The root `README.md` indexes these folders. Future module files should follow the same organization. The design plan and inactive generator drafts remain outside the module library. This change only reorganizes delivery paths; module logic and saved-project interfaces remain unchanged.

### Stage 7 implementation contract — authorized 2026-10-11

Deliver sixteen external VHDL/package definitions in five new categories, with individual imports, category packs, notes, examples and a ZIP under the existing module root. Preserve old definitions and primitive behavior. Add only friendly parameter choices and divider clock diagnostics to the editor.

- Arithmetic (7): add/subtract with carry/borrow input and unsigned/signed flags; full multiplication with WIDTH-bit low/high halves; unsigned/signed iterative divide with quotient/remainder; negate/absolute; bitwise operations; shifts/rotates; reductions and even/odd parity. WIDTH 1–64. Division captures inputs on accepted start, takes WIDTH enabled progress edges, ignores start while busy, pauses with en=0, and reports done for one source clock. Divide-by-zero and signed minimum/-1 finish immediately with valid=0 and explicit error flags. Other arithmetic is combinational. Signed minimum negate/absolute preserves its bit pattern and raises overflow; no silent saturation. Shift amount is a seven-bit unsigned bus, so shifts beyond WIDTH have defined zero/sign filling and rotations reduce modulo WIDTH.
- Comparison (4): signed/unsigned magnitude compare, inclusive/exclusive range check, clamp and min/max. Invalid range gives within=0; clamp passes input through with valid=0. Width settings are independent of visual size.
- Encoding (1): 1–64 input priority encoder with six-bit index, valid and multiple flags, high/low priority and optional strict one-hot acceptance. Disabled and invalid code are zero; valid distinguishes index zero from no asserted input.
- Conversion (2): unsigned/signed magnitude BIN→BCD and BCD→BIN, WIDTH 1–64, DIGITS 1–20. Decimal digit 0 occupies bits 3:0. Full twenty-digit results use bcd_lo[64] and bcd_hi[16], preserving all digits. Explicit digit-validity, configured digit-count overflow, signed bounds and minimum signed magnitude. Conversion is combinational, with no hidden handshake or truncation.
- Formatting (2): nibble→decimal/HEX ASCII and a packed-digit Number Formatter. Formatter takes the converter's two digit buses, negative and input_valid, with decimal/HEX mode, sign cell, leading zeros/spaces, fixed fractional position and letter case. Four 64-bit output buses carry up to 32 ASCII characters (character zero in bits 7:0), with length/valid/overflow. Invalid digits/input show question marks; overflow shows hash marks. Formatting remains separate from physical display drivers and supports direct BIN→BCD→ASCII schematic composition.

Verify through the actual Studio parser/import/export: source/package parity, generic boundaries, independent settings, source updates, save/load and Undo. Use BigInt reference values and GHDL simulation for signed/unsigned extremes, WIDTH 1/odd/32/64, full products, divide timing/reset/enable/error paths, parity/shift/encoding, twenty-digit BCD and ASCII cells. Synthesize representative exports; check mixed schematic composition and browser import. No Vivado timing/physical-board claim.

### Stage 7 delivery and verification — 2026-10-11

- Delivered sixteen matching VHDL/individual component-package pairs: `arithmetic/` (seven), `comparison/` (four), `encoding/` (one), `conversion/` (two), `formatting/` (two), plus five category packs under `modules/packs/`. The complete external library now contains 37 modules in ten categories. Existing sources and packages remain unchanged; nothing is automatically installed in Studio.
- Arithmetic/comparison WIDTH is 1–64; signedness and operations are configured independently per instance. Multiply exposes the full product as two WIDTH-bit halves, preserving all 128 bits at WIDTH=64. Conversion preserves all twenty decimal digits using 64/16-bit digit buses. Divider uses WIDTH subsequent enabled progress clocks with explicit start/busy/done/valid/error semantics. Formatter exposes four 64-bit ASCII buses for the later LCD driver.
- Editor changes are limited to friendly choices for the supplied package metadata, required-clock diagnostics for the iterative divider and numeric generic fields resolving their declared bounds from the current instance. For example, FRACTION_DIGITS supports 0–20 when DIGITS=20. Generic validation, source replacement, independent settings, persistence and Undo use the existing paths.
- All initial 163 Phase 7 tests passed in the serial regression run, including actual import/export, BigInt reference simulations, signed/unsigned boundary values, one-bit/odd/32/64 widths, full products, divider control/errors, twenty-digit conversions, ASCII byte order and GHDL synthesis of all sixteen imported definitions. A subsequent dependent-range control test passed; the final import/control subset passed 19/19 and existing editor/parameter-preview checks passed 24/24 after that isolated UI adjustment.
- The serial full suite passed **580/580** with no failures/skips (`node --test --test-concurrency=1 --test-reporter=tap schematic2vhdl/*.test.js`; log `/private/tmp/phase7-regression.log`). The isolated numeric-field range adjustment was made after that run started and verified with the 43 focused checks above plus the browser; the full suite was not repeated for that small UI change. `git diff --check` passed.
- Browser smoke: imported the actual BIN→BCD and formatter raw VHDL, imported the fully wired example, selected it as Top, passed Check and generated three entities. The exact browser-generated bundle compiled and synthesized with GHDL. Reopening preserved sources/configuration; changing DIGITS 5→20 updated the FRACTION_DIGITS maximum to 20 and preview/Apply accepted FRACTION_DIGITS=20 without removing any wires. Console had no warnings/errors. Proof: `/private/tmp/schematic-phase7-modules.png` and `/private/tmp/schematic-phase7-dependent-controls.png`.
- Delivery guide: `modules/PHASE7.md`; library index: `modules/README.md`. Two composed examples under `modules/examples/phase7-*.schtxt` passed GHDL simulation. `modules/downloads/phase7-modules.zip` contains 41 files: all new sources/packages, five category packs, the index/guide and both examples. ZIP contents are checked against the source files.

Phase 7 is complete. Next planned work is Stage 8 seven-segment, LCD and SPI ADC interfaces, reusing accepted lab internals. Stage 9 then composes Button Input, ALU, FSM and MM:SS timer examples. No Stage 8/9 implementation, supplied-lab changes, Git mutations, deployment, Vivado build/resource/timing result or physical-board validation was performed in this stage.


### Stage 8 implementation contract — authorized 2026-10-11

Deliver eight external modules in seven-segment (3), LCD (3) and ADC (2), with matching editable VHDL, individual/category packages, examples, a usage/provenance guide and a ZIP. Extend only existing friendly generic choices and clock diagnostics in Studio.

- Seven-segment: independent decimal/HEX/raw digit decoder, decimal/HEX digit-bus-to-pattern packer (1–16 digits), and a scanner consuming packed raw bytes (segments bits 6:0 = G..A; bit 7 = dot). Canonical patterns are active high; scanner applies independent segment/common polarity, snapshots each frame and inserts two blank source-clock intervals (disable common, then change pattern) before activating the next common. Blank/dot are independent per digit. Shared real clock, reset, enable and configurable slot cycles; enabled scanner frame/slot events have explicit timing.
- LCD: reusable eight-bit byte-write engine with start/busy/done and explicit setup/high/hold durations, matching the lab's low/high/low E phases; a 16×2 display controller with a captured 32-byte frame, initialization and update/done/ready semantics; and a text overlay block that inserts a formatter field at any cell offset with visible clipping. Text buses use the Phase 7 byte order. Defaults use the 50 MHz board clock; configurable cycle counts are not measured timing. Keep each complete byte transaction running if enable changes; enable only gates accepting updates.
- LCD initialization uses the lab command values 38/0C/06/01 and row addresses 80/C0. Add three initial 30 function-set writes, conservative power-up/initialization/clear waits, following the HD44780U 8-bit initialization procedure. R/W is write-only zero. Do not assume an exact LCD controller variant or physical board validation.
- ADC: preserve the accepted lab's divider, frame counter, MOSI/CS logic and serial/output registers. Extract its ADC-only branch, expose the existing 12-bit output, export equivalent flattened structural VHDL and add a frame-completion event monitor on the shared clock. Clear_valid resets only new event/valid state; it never resets or gates the accepted free-running ADC logic. An independently usable sample-event adapter accepts already-latched data and CS from an existing lab circuit. No new channel-select protocol, ADC-model guess or pin remapping.

Verify new import/ports/configuration/persistence/Undo and source/package parity; simulate new decoder/scanner/byte engine/controller/overlay/event adapter and their compositions with GHDL. Compile/synthesize the generated ADC delivery to check integration, without re-auditing/retesting accepted lab internals. Check actual browser import/generation and keep target Vivado/physical timing validation separate.


### Stage 8 delivery and verification — 2026-10-11

- Added eight external modules under `modules/seven-segment/` (3), `modules/lcd/` (3) and `modules/adc/` (2), each with an exact-source individual package. Three category packs and three compositional Schematic Text examples are supplied. The individual LCD controller package includes its byte-writer dependency. The module catalog now contains 45 modules in 13 categories.
- `modules/PHASE8.md` documents digit/byte order, masks, frame snapshots, polarity, LCD text placement and handshake/timing, ADC completion conventions and provenance. `modules/downloads/phase8-modules.zip` contains 30 files: eight source/package pairs, three category packs, three examples, three guides/indexes, ADC provenance and the two Phase 7 source/package dependency pairs used by the examples.
- ADC-only export has 260 flattened components and 361 wires, zero Studio export fallbacks, and preserves original clock-divider/frame/MOSI/CS/register logic. Added event flags run on the shared main clock; clear_valid does not reset the accepted lab core. The source SHA256 is recorded in `modules/adc/provenance.json`. The original lab file was not changed or functionally re-audited/retested.
- Editor changes are limited to friendly bounded Phase 8 generic choices and clock requirements for its sequential packages. Sources remain external; old module files and project defaults are preserved.
- The focused regression run passed **92/92** with no skips (44 Phase 8 checks plus existing module distribution/import/generic tests). Three additional ZIP/integer-maximum synthesis checks passed **3/3**, and the existing dependent formatter-control regression passed **1/1**, bringing current Phase 8 coverage to 47 tests and verified focused checks to 96. The full preexisting electrical/routing suite was not repeated because shared generation, width and routing logic did not change.
- GHDL compiled/simulated new decoder tables, digit packing, break-before-make scanning, complete-frame capture, byte-engine timings, LCD initialization/32 cells/two row addresses, text overlays and the independent ADC event adapter. All eight imported module families and the ADC→BCD→display composition synthesized. Maximum scanner/LCD timing counts synthesized; full billion-cycle waits were not simulated.
- Browser smoke verification imported the actual raw packer/scanner sources, created a wired HEX display, selected its top, passed Studio Check and generated three entities. The actual browser-generated bundle compiled and synthesized with GHDL. Console reported no warnings/errors. Proof: `/private/tmp/schematic-phase8-modules.png`.

Phase 8 is complete. Stage 9 remains planned: composed Button Input, ALU, FSM template and MM:SS timer modules/examples. No Stage 9 implementation, Git mutation, deployment, Vivado build/timing validation or physical-board/LCD/ADC test was performed.


### Stage 9 implementation contract — authorized 2026-10-11

1. Deliver four externally imported modules in `modules/compositions/`, with exact VHDL/individual packages and one category pack. Reuse existing entities and include each root's dependency closure; preserve all earlier sources. Provide a separate inspectable FSM Schematic Text template and three wiring examples, a PHASE9 guide and a ZIP with their dependencies. No built-in module catalog or new FSM language.
2. Button Input composes SYNC→DEBOUNCE→EDGE, sharing clk/rst. Expose stable q, pressed/released and selected pulse. STAGES 2–64; STABLE_CYCLES/CLOCK_HZ; ACTIVE_LOW; MODE rising/falling/both. Synchronizer reset matches physical inactive polarity. Edge events occur one clock after debounced q changes. Reuse the debounce-ms helper.
3. ALU WIDTH 1–64, signed/unsigned, three-bit opcode: 0 add, 1 subtract, 2 multiply, 3 divide, 4 AND, 5 OR, 6 XOR, 7 NOT a. Capture at enabled idle start; fast operations complete that edge, division uses the existing iterative module with captured operands and WIDTH+2 subsequent clocks when unpaused (errors complete after two). Expose y/result_hi (multiply high half or divide remainder), busy/done/valid and carry/borrow/overflow/divide-by-zero/zero/negative flags. Busy starts are ignored. rst aborts; en pauses division progress. Held start may repeat after completion; command inputs are clock-domain pulses.
4. FSM starts with an editable schematic using two enabled D flip-flops, equality decodes and ordinary gates: IDLE(0)→ACTIVE(1) on start; ACTIVE→DONE(2) on finish; DONE→ACTIVE on start. Cancel returns any state to IDLE and wins over events. ACTIVE ignores start; IDLE/DONE ignore finish. en holds valid states; invalid encoding 3 recovers to IDLE even if disabled. rst is synchronous and takes priority. Expose state, active, done (level) and invalid. Export this actual template as a matching VHDL box, rather than maintaining a second FSM implementation.
5. MM:SS timer composes bounded counters, Tick and BIN→BCD. MAX_MINUTES 0–99; TICKS_PER_SECOND defaults to 50,000,000. clk/rst/en/start/pause/load/down; load_minutes[7], load_seconds[6]. Reset to 00:00 stopped; valid load stops at the supplied time, invalid load holds the time, stops and pulses load_error. Commands take priority over counting: rst > load > pause > start > terminal/tick. start at endpoint pulses done without counting. Otherwise count up to MAX_MINUTES:59 or down to 00:00, stop on arrival and pulse done once. Reset/load/start/pause and en=0 reset the fractional divider, so resume waits a full interval plus one pipeline clock. Expose binary minutes/seconds, packed MMSS digits, running/terminal/done/valid/load_error. Physical drivers remain separate.
6. Extend composition parameter labels, shared debounce helper availability and clock diagnostics in Studio. Allow component packages to resolve dependencies already installed in the destination, while preserving strict duplicate-root rejection and leaving ordinary project imports self-contained. Supply a roots-only add-on for existing projects; full/individual packs include their dependency closures for new projects. Verify imports/dependency closure, Undo/save/replace, exact sources, bounds, meaningful GHDL command/latency/overflow/rollover/priority behavior and real browser export. Physical/Vivado validation remains separate; no lab re-audit, Git mutation or deployment.


### Stage 9 delivery and verification — 2026-10-11

- Delivered four external VHDL/package pairs under `modules/compositions/`: conditioned Button Input, 1–64-bit signed/unsigned ALU, editable three-state FSM and bounded up/down MM:SS Timer. The catalog now contains 49 distinct modules in 14 categories. The full composition pack includes ten unchanged foundations (14 definitions); the existing-project add-on imports only four new roots and preserves installed dependency sources. Individual packages include their own dependency closures.
- The FSM source is the exact export of `modules/compositions/ss_fsm_template.sch.txt`, using two native enabled D flip-flops and ordinary gates/decoders. No separate FSM implementation or custom language was added. Three Schematic Text examples compose the ALU, conditioned buttons/timer/seven-segment and timer/formatter/colon overlay/LCD.
- Editor changes are limited to composition settings/clock diagnostics, availability of the existing debounce-ms helper for Button Input, and component-package resolution of dependencies already present in the destination. Ordinary project imports still require self-contained dependencies. Duplicate entity names remain rejected, and failed multi-file imports are atomic.
- `modules/PHASE9.md` documents commands, polarity, packed digit order, arithmetic flags and handshake, division latency, FSM event priority/recovery and timer fractional-reset behavior. `modules/downloads/phase9-modules.zip` contains 53 files: 21 exact-source VHDL/package pairs, the full/add-on packs, editable FSM template, three examples and five guides/indexes. Existing ZIPs remain unchanged historical snapshots. The archive test compares every file to the delivered source and verifies fresh-project and 45→49-module existing-project import routes.
- Focused serial regression passed **218/218**, with no failures or skips, including **45 Phase 9 checks** plus Phase 8, distribution/import/generic/source-replacement, project import, input conditioning and Schematic Text checks. Command: `node --test --test-concurrency=1 schematic2vhdl/phase9-module.test.js schematic2vhdl/phase8-module.test.js schematic2vhdl/module-files.test.js schematic2vhdl/vhdl-generic.test.js schematic2vhdl/vhdl-module.test.js schematic2vhdl/project-import.test.js schematic2vhdl/input-conditioning.test.js schematic2vhdl/schematic-text.test.js`; log `/private/tmp/phase9-regression.log`. The full electrical/routing suite was not repeated; the shared changes concern module presentation and dependency validation rather than generation/routing. `git diff --check` passed.
- GHDL compiled/simulated button bounce/latency/reset, ALU 1/8/64-bit signed/unsigned results/flags and captured iterative divide/pause/error/reset, exhaustive legal FSM events and invalid-state recovery, timer reset/load/rollover/borrow/pause/endpoint/control priority, and all three examples. All four families synthesized at boundary configurations, including 64-bit signed ALU and maximum timing counts. Billion-clock intervals were not simulated.
- Browser smoke used the actual UI to paste/validate/import the FSM template, select it as top, pass Check and generate its entity. The exact browser output compiled and synthesized with GHDL. Console had no warnings/errors. Proof: `/private/tmp/schematic-phase9-modules.png`; exact export: `/private/tmp/phase9-browser-fsm.vhd`. The temporary tab/server were closed without changing the user's existing tab.

Stages 1–9 are complete within the current plan. Earlier lab files and foundational module sources remain unchanged; accepted ADC internals were not functionally re-audited/retested. No Git mutation, deployment, Vivado build/resource/timing result, board programming or physical button/display/ADC test was performed. Separate later designs noted above (such as wider JK/T/SR storage or pairwise signal mapping) remain outside this completed nine-stage contract.

## Personal-use UX simplification

วันที่: 2026-10-16 · รวมแผนและเริ่ม UX-A: 2026-10-18

เป้าหมายคือให้ใช้ทำ lab ของตัวเองได้เร็วขึ้น เปิดมาแล้วเลือกชิ้นส่วน ตั้งค่า ต่อสาย และ export ได้เลย ข้อความที่มีไว้สอนการใช้หรืออธิบายเรื่องเดิมซ้ำ ๆ เอาออกจากหน้าทำงาน ปัญหาและหลักฐานอยู่ใน [UX_ISSUES.md](UX_ISSUES.md) หมายเลข UX-01 ถึง UX-21 ครอบคลุมทั้งอุปกรณ์พื้นฐาน schematic ย่อย และโมดูล VHDL

ใช้ [Product Design and UX](/Users/te/.codex/skills/product-design-and-ux/SKILL.md) กำหนด flow กับผลของแต่ละคำสั่ง และ [Feedback Patterns](/Users/te/.codex/skills/feedback-patterns/SKILL.md) ลดการแจ้งผลที่ขัดจังหวะ แผนนี้ยึดคำขอล่าสุดเรื่องเครื่องมือใช้ส่วนตัวเป็นหลัก

### ลำดับงานที่รวมแล้ว

| Phase | งานและ issue ที่ครอบคลุม | สถานะ |
|---|---|---|
| UX-A | Export/Check, ตรวจสายก่อนแทน driver, Inspector/selection, ลบพอร์ตข้ามแผ่น — UX-11/12/14/16/18/20/21 | เสร็จและตรวจในเครื่องแล้ว 2026-10-18 |
| UX-B | ลดข้อความ จัด Inspector และข้อมูลพอร์ต — UX-06/09/10/19 | ส่งมอบแล้ว · ผู้ใช้ข้ามการตรวจเพิ่ม 2026-10-20 |
| UX-C | Import ตรง เพิ่ม dependency ต่อได้ หาโมดูลใหม่เจอ — UX-01/02/13 | ส่งมอบแล้ว · ผู้ใช้ข้ามการตรวจเพิ่ม 2026-10-20 |
| UX-D | วิธีหยิบ/วาง ตั้งค่า resize และกลับจาก submodule — UX-03/04/05/07/08/15/17 | ส่งมอบแล้ว · source อยู่ใน Inspector ตามคำขอ 2026-10-21 |
| UX-E | ตรวจ flow รวมและความเข้ากันได้ของโปรเจกต์เดิม | จบรอบตรวจตามขอบเขตที่ผู้ใช้เลือก · ไม่บังคับ checklist เพิ่ม |

UX-A ทำตามลำดับ: Export/Check → ตรวจสาย → Inspector → pending delete พอร์ต → regression/browser และบันทึกผล ใช้ส่วนประกอบเดิมใน `schematic2vhdl/index.html` ไม่เปลี่ยน logic ของโมดูลที่แจก และไม่เริ่ม UX-B–UX-E ในงานรอบนี้

### หน้าทำงานและข้อความ

- ใช้ canvas, Components, Inspector และแท็บผลลัพธ์เดิม จัดลำดับใหม่ในพื้นที่เดิม ไม่เพิ่มหน้าเริ่มต้น wizard หรือโหมด Basic/Advanced
- ทางเข้าหลักเห็นชัด: `Import Module…`, ค้นหาชิ้นส่วน, `Check`, `Generate VHDL` ปุ่มนำเข้าไม่กลับไปเป็นลูกศรเล็ก ๆ ส่วนคำสั่งแปลง VHDL เป็นเกต, วาง Schematic Text และนำเข้า package/project อยู่ในเมนูรองตามผลลัพธ์ของแต่ละคำสั่ง
- Inspector เริ่มจากชื่อกล่องและค่าที่ใช้จริง เช่น WIDTH, ขอบ clock, enable และ generic ของโมดูล พิกัด/ขนาดภาพอยู่ในส่วน `Layout` ที่พับได้ ส่วน ports/source/export package เปิดเมื่อเรียกดู
- ตัดข้อความสอนใช้ คำรับรองว่าอะไรไม่เปลี่ยน และคำเตือนเชิงป้องกันความเข้าใจผิดที่แสดงตลอดเวลา ไม่ย้ายย่อหน้าทั้งหมดไปกองใน tooltip
- ใช้ชื่อช่องกับหน่วย เช่น `WIDTH (bit)`, `กว้าง (px)`, `สูง (px)` ชื่อปุ่มและ accessible label ต้องยังบอกคำสั่งได้ชัด ไม่ลดทุกอย่างเหลือไอคอน
- ค่าที่เปลี่ยน กล่องที่วาง และสายที่ต่อ เป็น feedback ของการทำงานนั้นอยู่แล้ว ไม่ต้องมี toast ยืนยันทุกครั้ง สถานะสั้น ๆ แสดงเฉพาะตอนรอ ประสบปัญหา หรือมีผลที่มองไม่เห็นจาก canvas
- Error อยู่ใกล้ช่องหรือคำสั่งที่ผิด บอกชื่อ/ค่าที่ต้องแก้และมีทางแก้ต่อได้ เก็บข้อมูลที่กรอกไว้ ข้อความห้ามหายไปเองก่อนอ่านหรือแก้ทัน
- คงสถานะที่จำเป็น เช่น เครื่องมือที่กำลังใช้, top ที่เลือก, งานที่ยังไม่บันทึก, ค่าที่รอ Apply และจำนวนปัญหา ผล Check/โค้ดเก่าต้องไม่แสดงเหมือนเป็นผลของวงจรปัจจุบัน

| ข้อความ/ส่วนปัจจุบัน | วิธีจัดการ |
|---|---|
| `EN=1 ทำงาน… Async reset → preset → clock + enable` ใน Inspector/หน้าตั้งค่าก่อนวาง | เอาย่อหน้าออก คงตัวเลือก enable, clock และ reset ตามเดิม |
| `ขนาดภาพแยกจากจำนวนบิต` และคำอธิบายซ้ำใต้ขนาดภาพ | เอาออก ใช้ชื่อช่องและหน่วย |
| `พร้อมวาง · ยังไม่ได้เปลี่ยนวงจร` | เอาออก ใช้กล่องตัวอย่างบน canvas |
| ข้อจำกัดชนิด VHDL, dependencies และ `ต้อง compile/simulate…` ที่แปะไว้ตลอดหน้า import | เอาออกจาก flow ปกติ ถ้าไฟล์ไม่รองรับ ให้ error ระบุจุดที่ไม่รองรับตอนนั้น |
| ตารางพอร์ตครบทุกโมดูลก่อน import | เอาออกจากทางเข้าปกติ พอร์ตเปิดดูได้เมื่อเลือกโมดูล |
| `ถอดสาย 0 เส้น`, `เปลี่ยนขาที่มีสายต่ออยู่ 0 เส้น`, `สายอื่นคงเดิม · Undo…` | ไม่แสดงส่วนที่ไม่มีผลกระทบ ไม่เปิด dialog เพื่อบอกว่าไม่มีอะไรเสีย |
| `ใช้เป็นกล่องได้โดยไม่ต้องเปิด source…` และคำอธิบาย generic ซ้ำในหน้ารายละเอียด | เอาออก คงชื่อโมดูล ค่าจริง พอร์ต และ source เมื่อสั่งเปิดดู |
| แถบคู่มือ/shortcut ยาวใต้ canvas | ปิดจากหน้าทำงานปกติ คง Help และ tooltip ชื่อเครื่องมือ/ปุ่มลัดแบบสั้น |
| `schematic พร้อมสำหรับ Vivado` / `Synthesis check ผ่าน` | เปลี่ยนเป็น `Check: 0 errors · 0 warnings` ตามจำนวนจริง |
| Toast download ที่อธิบาย layout comment และ import กลับ | ตัดคำอธิบายออก ถ้าจำเป็นต้องแจ้ง ให้เหลือชื่อไฟล์ |
| Error หรือผลที่ต้องตัดสินใจจริง | เก็บให้สั้น เช่น `ขาด ss_lcd_write` + `เพิ่มไฟล์…`, `q: 8 → 9 bit · 1 สาย`, หรือ `อัปเดต ss_reg_pipo · 3 กล่อง` |

### Flow ที่จะใช้

**Import:** กด `Import Module…` → เลือกไฟล์ `.vhd` หลายไฟล์ได้ → ตรวจทั้งชุด → เพิ่มเข้า Components และเลื่อนไปให้เห็นรายการใหม่ ไม่มีหน้า Preview/Apply คั่นเมื่อไฟล์ใช้ได้ การ import ยังไม่วางกล่องลง canvas โดยเฉพาะชุดที่มี dependency ส่วนการวางโค้ดและ import รูปแบบอื่นยังเรียกจากเมนูรองได้

**วางและตั้งค่า:** กดชิ้นส่วน → เห็นตัวอย่างตามเมาส์ → ปรับค่าที่ Inspector ได้ก่อนวาง → คลิก canvas เพื่อวาง หรือ Esc เพื่อยกเลิก ลากจาก Components มาวางได้เหมือนเดิม หลังวางก็แก้ค่าผ่าน Inspector ชุดเดียวกัน

**ต่อสายและดูโค้ด:** ใช้การต่อสาย/บัสเดิม → กด Check เมื่อต้องการดูปัญหา → กด Generate VHDL เพื่อสร้างจากวงจรปัจจุบันและเปิดแท็บ VHDL → กด `.vhd` ในแท็บเมื่อต้องการดาวน์โหลด ตามคำขอ 2026-10-21 การดาวน์โหลดยังคำนวณใหม่จากวงจรล่าสุด

### UX-A — แก้ข้อมูลและผลตรวจให้ตรงกับวงจรก่อน

ครอบคลุม UX-11, UX-12, UX-14, UX-16, UX-18, UX-20, UX-21 เริ่มส่วนนี้ก่อนงานจัดหน้าตา เพราะมีทั้งไฟล์ export เก่า การต่อผิดขนาดที่แทนสายเดิม และ Inspector ที่แสดง selection ไม่ตรงกับสิ่งที่คำสั่งจะกระทำ

- ทุกทางที่ดาวน์โหลด VHDL ต้องสร้างจากสถานะปัจจุบัน ไม่ใช้ข้อความใน preview หรือ cache เก่าเป็นต้นฉบับไฟล์
- ปุ่มหลักเป็น `Export VHDL` ส่งออก top ที่เลือกพร้อม entity ที่อ้างถึง การ export entity เดียวเป็นคำสั่งรองที่ระบุ scope ชัด
- แท็บ VHDL ยังใช้ดู/คัดลอกโค้ดได้ แสดงสถานะสั้น ๆ เมื่อ preview เก่า และ refresh จากวงจรปัจจุบันได้ ไม่ถามให้ยืนยัน Generate อีกรอบ
- Check แสดงจำนวน errors/warnings ตามจริง ไม่มีคำอ้างว่า synthesis หรือพร้อมใช้งานกับบอร์ด ถ้ามีการแก้วงจร ผลเดิมต้องไม่ดูเหมือนยังเป็นผลล่าสุด
- Check หลักตรวจ top ที่เลือกพร้อมวงจรที่เรียกใช้ ให้ตรงกับขอบเขต Export แผ่นทดลองที่ไม่ได้ใช้ต้องไม่ทำให้ผลหลักขึ้น error ถ้าคงการตรวจทั้งโปรเจกต์ ให้เป็นคำสั่งรองที่ระบุ `Check Project` ชัดในเมนูเดิม ไม่เพิ่มโหมดหรือ popup เลือก scope ทุกครั้ง
- คงการสร้างโค้ดเพื่อตรวจสอบเมื่อมี diagnostics ตามพฤติกรรมเดิม แสดงปัญหาไว้ใน Issues โดยไม่เพิ่มขั้นตอนรับทราบคำเตือน ถ้าสร้างโค้ดล้มเหลว ห้ามดาวน์โหลดโค้ดเก่าแทน
- คงรูปแบบ `.vhd`, ลำดับ dependencies, source ที่ฝังไว้ และ layout round-trip
- ตรวจทิศทาง ขนาดบัส และ driver ของสายใหม่ก่อนแตะสายเดิม ถ้าต่อไม่ได้ ให้คงวงจรเดิมและแจ้งที่ขาให้เลือกปลายทางใหม่หรือ Esc ได้ ไม่ต่อผิดแล้วค่อยเตือน การต่อทับด้วยสายที่ถูกต้องยังทำได้ตรง ๆ ไม่เพิ่ม confirmation
- หลังลาก/ขยับด้วยลูกศร ให้ Inspector แสดงพิกัดและ selection จริง โดยเฉพาะการลากกลุ่มที่เริ่มกดจากตัวเดียว ต้องไม่เหลือหน้าตาเหมือนเลือกตัวเดียวแต่ปุ่ม Delete/แก้ค่าจะกระทำกับหลายตัว ไม่แย่ง focus ช่องที่กำลังกรอก
- ก่อนลบ IN/OUT ใน schematic ย่อยที่มี parent ใช้พอร์ตนั้น แสดงชื่อพอร์ตกับแผ่น/สายที่กระทบใน Inspector และให้ Apply/Cancel ครั้งเดียว การลบอุปกรณ์ธรรมดาหรือพอร์ตที่ไม่มี parent ใช้ยังทำได้ทันที Undo ต้องคืนทั้งพอร์ตและสายทุกแผ่น

จุดแก้: `generateVHDL`, `generateAllVhdl`, `exportVhdlFile`, `exportAllVhdl`, `runSynthesis`, `renderErrors`, `onPortClick`, `deleteSelection`, drag-end/keyboard handlers และ Inspector bindings

เกณฑ์จบ: export หลังเปลี่ยนชื่อ/generic/source/สาย/top และ Undo/Redo ต้องตรงกับวงจรล่าสุด; generation failure ไม่ปล่อยไฟล์เก่า; สายผิดขนาดไม่แทนสายดีเดิม; ลากกลุ่มแล้ว Inspector ระบุทั้งกลุ่มถูกต้อง; Cancel การลบพอร์ตย่อยไม่เปลี่ยนแผ่นใด และ Apply/Undo คืนได้ครบ; แผ่นที่ไม่อยู่ใน dependency ของ top ไม่ปนเป็น error ใน Check หลัก

ผลตรวจ UX-A — 2026-10-18:

- `node --test --test-concurrency=1 schematic2vhdl/*.test.js` ผ่าน 695/695 ไม่มี skip รวม [regression ใหม่ 22 กรณี](../schematic2vhdl-v2/ux-a.test.js) สำหรับ export ล่าสุด, Check scope, สายผิดขนาด/Bus Tap และการลบพอร์ตข้ามแผ่น
- ตรวจผ่าน browser จริง: เปลี่ยนชื่อ top หลังเปิด preview แล้วดาวน์โหลดไฟล์ใหม่, [ต่อสายผิดขนาดโดยสายเดิมยังอยู่](../output/ux-a-2026-10-18/rejected-wire.png), [ลากกลุ่มแล้ว Inspector ตรง](../output/ux-a-2026-10-18/group-inspector.png), [ผลก่อนลบพอร์ตพร้อม Cancel/Undo](../output/ux-a-2026-10-18/port-delete-impact.png) รวม Clear Schematic ของ child และ Check Top เทียบ Check Project เมื่อมีแผ่นทดลองที่ผิดอยู่
- GHDL analyze/elaborate ผ่านทั้ง [ไฟล์ที่ดาวน์โหลดจริงหลังเปลี่ยนชื่อ top](../output/ux-a-2026-10-18/browser-top.vhd) และ [โค้ด parent/child จาก preview](../output/ux-a-2026-10-18/browser-parent-preview.vhd) หลักฐานสองไฟล์นี้แยกกัน ไม่ได้ตรวจ Vivado หรือบอร์ด
- checksum ของ module artifacts เดิม 220 ไฟล์ไม่เปลี่ยน และ `git diff --check` ผ่าน ขอบเขต UX-A ไม่รวมงาน UX-B–UX-E

### UX-B — ลดข้อความและจัดพื้นที่ทำงาน

ครอบคลุม UX-06, UX-09, UX-10, UX-19 และรายการข้อความด้านบน

- เอาข้อความตามตารางออก จัด Inspector ให้ค่าของกล่องมาก่อนพิกัด/ขนาดภาพ/definition ใช้ส่วนพับใน panel เดิม
- ซ่อนตัวจัดลำดับพอร์ตของฝั่งที่มีเพียง 0–1 พอร์ต แทนการแสดงปุ่มขึ้น/ลงที่กดไม่ได้ รายละเอียดที่ไม่มีอะไรให้ปรับไม่ต้องกินพื้นที่
- ชื่อพอร์ตบนกล่อง submodule ต้องอ่านได้กับสีพื้นจริง แก้เฉพาะสี/label ของกล่องที่เกี่ยวข้อง ให้เห็นชื่อ ทิศทาง และขนาดบิตในจังหวะต่อสาย โดยไม่ต้องเปิดหน้ารายละเอียดและไม่เพิ่มย่อหน้าอธิบาย ไม่รื้อ theme ทั้งโปรแกรม
- คงทางเข้าหลักสำหรับ import กล่องโมดูลไว้ชัด ย้ายคำสั่งเฉพาะทางไปเมนูรอง ไม่สร้างหน้ารวม import ใหม่
- ขณะประกอบวงจร แสดงขาที่ขาดสายตรงจุดต่อ รายละเอียด fallback ไปอยู่ใน Issues/Check และสถานะตอน export แทนคำเตือนยาวบนทุกกล่อง
- คงการตรวจ input ที่ไม่ต่อสายและค่าทดแทนจริง ไม่เปลี่ยน raw VHDL ให้รับค่าเริ่มต้นจาก package โดยเงียบ ๆ
- ตรวจข้อความเฉพาะ flow ที่ปรับ รวมข้อความรอ/สำเร็จ/error ไม่แก้คู่มือทั้งโปรเจกต์หรือแตะ workbench อื่น

จุดแก้: `renderInspector`, `componentParamFields`, drawing controls, `renderProjectTree`, เมนู/toolbar, `canvasHint` และการแสดง diagnostics บนกล่อง

เกณฑ์จบ: เปิดกล่อง PIPO หรือโมดูล generic หลายตัวแล้วเห็นค่าที่ใช้จริงก่อน Layout ไม่มีข้อความสอนซ้ำตามตาราง ข้อมูลพอร์ต/source และคำสั่งรองยังเปิดใช้ได้ ปุ่มลัดและ focus ยังทำงาน ทดสอบที่หน้าต่างใช้งานจริง หน้าต่างแคบลง และ browser zoom 125% โดยไม่ซ่อนปุ่ม Apply/error ไว้นอกพื้นที่เลื่อน

ผลแก้และตรวจ UX-B — 2026-10-18:

- [Inspector ของ PIPO](../output/ux-b-2026-10-18/pipo-inspector.png) แสดงค่าของวงจรก่อน `Layout` ที่พับได้ ข้อมูลพอร์ต/source เปิดเมื่อเรียกดู ตัดคำอธิบายซ้ำและจำนวนผลกระทบที่เป็นศูนย์ออก คำแนะนำใต้ canvas เปิดเองได้จาก View
- ปรับพื้นกล่องและสีชื่อพอร์ตตาม theme เพิ่มชื่อ/ทิศทาง/จำนวนบิตเมื่อชี้พอร์ต และใช้ `!` ที่ขาซึ่งมีปัญหาแทนข้อความเหนือกล่อง เก็บรายละเอียด fallback กับการตรวจเดิมไว้ ไม่เปลี่ยนค่าเริ่มต้นของโมดูล
- ตรวจ UI จริงที่ 1280×720 และ [960×720](../output/ux-b-2026-10-18/narrow-layout.png): พิมพ์ค่าผิดแล้ว error อยู่ข้างช่อง, [ผลเปลี่ยน WIDTH พร้อม Apply/Cancel](../output/ux-b-2026-10-18/narrow-impact.png), Esc ยกเลิก, เปิด ports/source, R/Undo, resize/Undo, enable ใน draft และ reload ผ่าน [โมดูลที่มีพอร์ตฝั่งละขาเดียว](../output/ux-b-2026-10-18/single-port-layout.png) ไม่มีปุ่มจัดลำดับที่ใช้ไม่ได้ ตรวจสีทั้งธีมสว่างและ[มืด](../output/ux-b-2026-10-18/dark-pins.png)
- ชุดรวม `node --test --test-concurrency=1 schematic2vhdl/*.test.js` ผ่าน 698/698 ไม่มี skip รวม [regression ใหม่ 3 กรณี](../schematic2vhdl-v2/ux-b.test.js) สำหรับตำแหน่ง fallback และขนาดพอร์ตจริง checksum ของ module artifacts เดิม 220 ไฟล์ไม่เปลี่ยน
- Browser zoom 125% ยังไม่ผ่านการตรวจจริง: ปุ่มลัดผ่านช่องทางควบคุมไม่เปลี่ยน viewport/DPR จึงไม่นับการย่อ viewport เป็นผลทดแทน เก็บกรณีนี้ไว้ตรวจใน UX-E ไม่ได้ตรวจ Vivado/บอร์ดหรือทำ accessibility audit ในรอบนี้

### UX-C — Import ไฟล์แล้วหาโมดูลใช้ได้ทันที

ครอบคลุม UX-01, UX-02, UX-13

- ปุ่มหลักเปิด file picker ทันที ไฟล์ที่ใช้ได้เข้า library เป็นหนึ่ง transaction และ Undo ได้ทั้งชุด ไม่ต้องกด Import/OK ซ้ำ
- หลัง import ให้ reveal/highlight รายการใหม่ใน Components เดิม กรณีหนึ่งไฟล์ให้เห็นตัวนั้นทันที กรณีหลายไฟล์ให้เห็นกลุ่มรายการที่เพิ่ม โดยยังกลับไปค้นหาทั้ง library ได้ ไม่วาง dependency ลง canvas เอง
- ถ้าขาด dependency แสดงชื่อพร้อม `เพิ่มไฟล์…` และ `ยกเลิก` ในพื้นที่ import เดิม เก็บไฟล์ชุดที่เลือกไว้จนแก้ครบ ไม่บังคับเริ่มเลือกทั้งชุดใหม่
- ถ้า entity ที่ติดตั้งแล้วมี source และ support sources ตรงกัน ให้ข้ามตัวซ้ำนั้นโดยคง metadata เดิม ไม่ถามซ้ำหรือให้ไปเปลี่ยนชื่อไฟล์ ส่วน source ที่ต่างกันต้องเป็น conflict ที่ระบุชื่อชัด ห้าม overwrite อัตโนมัติ
- เมื่อยังมีไฟล์ผิด/ขาด/ขัดแย้ง ไม่ติดตั้งบางส่วน เมื่อยกเลิกไม่เปลี่ยนโปรเจกต์ ไม่สร้างระบบ conflict wizard เพิ่ม
- คงการ paste VHDL และ import package ไว้เป็นคำสั่งรอง ใช้ parser/validator/import transaction เดิม ไม่สร้าง format ใหม่หรือบังคับใช้ JSON

จุดแก้: `showVhdlModuleImport`, `planVhdlModuleImport`, import completion และ `renderPalette`

เกณฑ์จบ: ไฟล์ปกติหนึ่งตัวและชุด raw VHDL 49 ตัวเข้าได้โดยไม่มี application confirmation เพิ่ม ยกเลิก picker แล้วไม่มีการเปลี่ยน state ขาด LCD writer แล้วเพิ่มไฟล์ต่อได้ นำเข้าซ้ำเหมือนเดิมไม่เพิ่ม definition/กล่องซ้ำ ส่วน source ต่างกันยังคงโปรเจกต์เดิม ตรวจผ่าน native multi-file picker ด้วย ไม่จบที่การเรียกฟังก์ชันจำลอง

ผลแก้และตรวจ UX-C — 2026-10-18:

- ปุ่ม Import Module ใน Project และ Components เปิดเลือก `.vhd`/`.vhdl` หลายไฟล์ทันที ชุดที่ถูกต้องเข้า library โดยไม่มี Preview/Apply เพิ่ม รายการใหม่ขึ้นกลุ่ม `นำเข้าล่าสุด` บนสุด พร้อมกลับไปดูทั้งหมดได้ ไม่วางกล่องลง canvas เอง ส่วน Paste VHDL และ import package ยังอยู่ใน Tools
- ชุดที่ขาด dependency หรือมีไฟล์ผิดคงไฟล์เดิมไว้ใน Components พร้อมชื่อปัญหา เพิ่มไฟล์/เอาไฟล์ออก/ยกเลิกได้ ไม่ติดตั้งบางส่วน และไม่นำผลอ่านไฟล์ที่มาช้าไปใช้หลังยกเลิกหรือเปลี่ยนโปรเจกต์
- Entity ที่มี source เดิมและ required support sources ตรงกันข้ามได้โดยไม่แก้ metadata/default inputs/instance settings หรือเพิ่ม Undo ส่วนชื่อซ้ำที่ source ต่างกันปฏิเสธทั้งชุด ตรวจซ้ำก่อน commit; ชุดที่เพิ่มจริง Undo/Redo ได้ครั้งเดียว
- `node --test --test-concurrency=1 schematic2vhdl/*.test.js` ผ่าน **713/713** ไม่มี skip รวม [regression UX-C 15 กรณี](../schematic2vhdl-v2/ux-c.test.js): raw VHDL จริง 49 ไฟล์, LCD writer recovery, duplicate/conflict, read failure, cancel ระหว่างอ่าน, project switch และ Undo/Redo การส่งไฟล์เข้า event handler ใน tests เป็นการจำลอง file transport ไม่ใช่ผล native picker
- Browser จริงยืนยัน [นำเข้า PIPO ไฟล์เดียว](../output/ux-c-2026-10-18/single-import.png) ได้โดยไม่ยืนยันในแอปอีกครั้ง และอยู่บนสุดใน Components จำนวน canvas ยังคง 8 components/8 wires; picker เปิดแบบ multiple ได้ การตรวจชุด 49 ไฟล์และ recovery ผ่าน native picker ยังไม่จบ: in-app browser ค้างระหว่างควบคุม picker ส่วน Chrome extension ปฏิเสธการส่งไฟล์เพราะยังไม่เปิด `Allow access to file URLs` ไม่เปลี่ยนสิทธิ์ browser ในงานนี้ จึงยังไม่ถือว่าผ่านเกณฑ์ UX-C ครบทุกข้อ
- checksum ของ module artifacts เดิม **220 ไฟล์ไม่เปลี่ยน** และ `git diff --check` ผ่าน ไม่เปลี่ยน logic ของโมดูลหรือเริ่มงาน UX-D ในรอบนี้

### UX-D — วาง ปรับค่า และย่อขยายโดยไม่เปิดหน้าซ้ำ

ครอบคลุม UX-03, UX-04, UX-05, UX-07, UX-08, UX-15, UX-17

- เลิกวางที่กลางจอพร้อม offset สุ่ม ใช้ตัวอย่างก่อนวางและ Inspector ของ draft แทนหน้าตั้งค่าก่อนวางแยก/checkbox เปิด modal ทุกครั้ง
- ใช้วิธีเลือก/วางเดียวกันกับ primitive, `SCH` และ `CUSTOM` ทั้ง Components และรายการ `USE AS SUB-BLOCK`: คลิกแล้วพร้อมวาง ลากแล้ววางได้ตรงตำแหน่ง ปรับค่าของกล่องที่เพิ่งวางได้ทันทีผ่าน Inspector ส่วนรายการ `SCHEMATICS` หลักยังใช้เปิดแผ่นและลากจัดลำดับตามเดิม
- จำ pan/zoom ของแต่ละแผ่นใน session เมื่อเข้าไปดูวงจรย่อยแล้วกลับมา ให้คงมุมเดิม Fit/Home ยังเรียกใช้เองได้ ไม่เปลี่ยนรูปแบบไฟล์โปรเจกต์เพื่อเพิ่ม preference นี้
- การตั้งค่าที่ไม่กระทบสายที่ต่ออยู่หรือทำค่าหาย ใช้ได้ทันทีหลังค่าผ่าน validation ไม่เปิด Preview/Apply แม้เป็น generic หรือ Bus Tap range การเปลี่ยนจำนวนพอร์ตที่ยังไม่ต่อสายก็ไม่ต้องยืนยัน
- ขณะพิมพ์ตัวเลข เก็บเป็น draft ของช่องก่อน ยืนยันด้วย Enter/ออกจากช่องเมื่อถูกต้อง ไม่ apply เลขที่ยังพิมพ์ไม่ครบ ถ้าผิดให้ error ข้างช่อง คงค่าจริงล่าสุดและ focus ไม่ render Inspector จนช่องที่กำลังแก้หาย
- ถ้ามีสายต่ออยู่ที่ interface ซึ่งเปลี่ยน หรือจะตัดค่า CONST/ถอดพอร์ตที่มีสาย ใช้รายการผลจริงใน Inspector พร้อม Apply/Cancel ชุดเดียว ไม่เปิด popup ซ้อน ข้อมูลที่แสดงคือพอร์ต/ปลายสาย/ค่าที่เปลี่ยนจริง ไม่แสดงหัวข้อผลกระทบว่าง ๆ
- Pending edit ยังไม่แก้วงจร Esc/Cancel คืนค่าเดิม การเปลี่ยน selection ยกเลิก pending instance edit โดยไม่ apply ให้กล่องอื่น หลัง Apply ให้ Undo คืนค่า พอร์ต สาย และ parent-sheet ผลกระทบได้ครบหนึ่งครั้ง และตรวจแผนกับ state ล่าสุดก่อนใช้
- Preset ย่อ/ขยาย ช่องขนาดภาพ และ resize handle แสดงผลบน canvas โดยตรง มีหนึ่ง Undo ต่อการทำรายการ คง layout lock, port IDs และพฤติกรรมการจัดสายเดิม ไม่ยืนยันขนาดภาพที่ไม่มีผลทางไฟฟ้า
- พอร์ต/source เปิดดูจากบริบทโมดูลเดิม ไม่ไล่ Info → หน้ารายละเอียด → Preview → Apply การแก้ source ยังมี editor และปุ่ม Update/Cancel ชัด เพราะใช้ร่วมกันหลายกล่อง ระบุชื่อ definition กับจำนวนกล่องที่กระทบ และแสดงเฉพาะ interface ที่เปลี่ยน ตรวจ draft ให้ผ่านก่อน Update ครั้งเดียว
- Source error ต้องคงข้อความที่แก้ไว้ การ Cancel ไม่เปลี่ยน definition การ Update สำเร็จ Undo คืน source/generic/สายได้ครบ ไม่มีการ autosave source ให้ทุกกล่องจากการพิมพ์ธรรมดา
- ใช้เมาส์และ keyboard ได้: focus คงตำแหน่งหลังแก้ค่า Esc ยกเลิก draft การวางมีทางเลือกเข้าจาก Components และขยับ/ยืนยันด้วย keyboard ได้โดยต่อยอดระบบปุ่มเดิม

จุดแก้: `requestPalettePlacement`, `showConfigureComponent`, `requestComponentParamChange`, `showComponentParamPreview`, resize handlers, `showVhdlModuleInfo`, `showVhdlModuleReplacement` และ Inspector bindings

เกณฑ์จบ: primitive/SCH/CUSTOM ใช้ได้ทั้งคลิกเลือกแล้ววางและลากวางจากทางเข้าที่เกี่ยวข้อง; เลือกอย่างเดียวยังไม่เพิ่ม component; Esc ไม่เหลือกล่อง; เข้า child แล้วกลับ parent ได้มุมเดิม; เปลี่ยน EDGE_FALLING ที่ไม่มีสายและขยายภาพ 150% ไม่มี modal; WIDTH ที่มีสายแสดง endpoint จริงก่อน Apply; เปลี่ยน source ระบุ scope และผ่าน validation; Cancel/Undo/Redo ได้ผลครบโดย focus ไม่กระโดดไป Cancel

ผลแก้และตรวจ UX-D — 2026-10-20:

- Components และ `USE AS SUB-BLOCK` ใช้การหยิบ/ลากชุดเดียวกันสำหรับ primitive, SCH และ CUSTOM: คลิกแล้วแสดงตัวอย่างตามเมาส์ ตั้งค่าร่างผ่าน Inspector และคลิก canvas เพื่อวาง; ลากแล้วปล่อยบน canvas วางได้ครั้งเดียว ปล่อยนอก canvas/Esc ยกเลิกโดยไม่แก้โปรเจกต์ คงชื่อ IN/OUT อัตโนมัติเดิม รองรับ keyboard เลือกจากรายการ, ลูกศร, R/M, Enter และ Esc ตัด checkbox/gear กับหน้าตั้งค่าก่อนวางแยกออก
- ค่าที่ไม่กระทบสายหรือทำค่าหายใช้ตรงได้ รวม generic และ Bus Tap range ช่องตัวเลขตรวจขณะพิมพ์ ใช้ค่าเมื่อ Enter/ออกจากช่อง ไม่ clamp ค่าผิดให้เงียบ ๆ และคง focus/ข้อความที่ต้องแก้ไว้ การคลิก canvas เพื่อวางอ่านค่าที่ยังอยู่ในช่องก่อนเพิ่มกล่องด้วย
- การเปลี่ยน interface ที่มีสาย, ถอดสาย, ตัด CONST หรือกระทบ parent อยู่ใน Inspector เดิมพร้อม endpoints จริงและ Apply/Cancel ไม่เปิด modal เพิ่ม Draft ยังไม่แก้ model; Esc/เปลี่ยน selection ยกเลิก; Apply ปฏิเสธเมื่อโปรเจกต์เปลี่ยนหลังวางแผน และ Undo/Redo ครอบคลุมทั้งรายการ
- ขนาดภาพผ่านช่อง, preset และ handle ใช้กับ canvas โดยตรง ไม่เปิดหน้าต่าง Preview ขนาด คงการปรับสายเฉพาะที่และ layout lock เดิม แยกข้อมูล pan/zoom ของแต่ละแผ่นไว้เฉพาะ session เข้า child ผ่านสอง instance แล้วกลับ parent ได้มุมเดิม
- พอร์ตเปิดดูใน Inspector และ Source เปิด editor เดียว ตรวจ source ที่พิมพ์พร้อมชื่อ definition/จำนวนกล่องที่ใช้ร่วมกันและเฉพาะ interface ที่เปลี่ยน ไม่มีปุ่ม Preview แยก; source ผิดยังอยู่ให้แก้ Update ครั้งเดียวและ Undo ได้ คง export package ไว้ แก้สีปุ่ม primary ตอน hover ให้ยังอ่านออก
- Browser จริงที่ local origin แยกยืนยัน click/keyboard placement, ลาก primitive/VHDL/SCH จริง, สอง instance ของ child, pan/zoom คืนทั้งสองแผ่น, กรอกค่าแล้วคลิกวางทันที, ข้อมูลผิด/Esc/ปล่อยนอก canvas, EDGE_FALLING ตรง, resize 150%, WIDTH ที่มีสาย Apply/Undo/Redo, selection cancellation, Tab focus และ source error/Update ผ่าน [ภาพ Inspector](../output/ux-d-2026-10-20/connected-impact.png) แสดง model 8 บิตกับ draft 64 บิตก่อน Apply
- [regression UX-D 18 กรณี](../schematic2vhdl-v2/ux-d.test.js) ตรวจ draft/drag transaction, active field ก่อนวาง, ชื่อ I/O, stale owner/plan, direct/pending changes, cancel, exact endpoints, per-sheet views และ shared-source update; ปรับ tests เดิมเฉพาะ preview ที่เลิกใช้และจังหวะ commit ของช่องขนาด ไม่เพิ่ม framework/dependency
- ชุดรวม `node --test --test-concurrency=1 schematic2vhdl/*.test.js` ผ่าน **731/731** ไม่มี skip รวมการ compile/simulate/synthesize ด้วย GHDL ที่มีอยู่ในชุดเดิม และ `git diff --check` ผ่าน การตรวจ UI เป็น agent-operated local browser check ไม่ใช่ผลทดสอบ Vivado/บอร์ดหรือ usability study กับผู้ใช้
- module artifacts เดิม 220 ไฟล์ไม่เปลี่ยน งานรอบนี้ไม่เริ่ม UX-E หรือเปลี่ยน logic ของโมดูลที่แจก รายการ native multi-file/recovery และ browser zoom 125% ด้านล่างยังค้างตามเดิม

### เขียนและแก้ VHDL ในโปรแกรม — 2026-10-20

ผู้ใช้ขอเปิดดูและแก้โค้ดของกล่อง VHDL รวมถึงเขียนโมดูลใหม่ใน Studio ได้โดยตรง ใช้ source editor, parser และระบบ Update/Undo เดิม ไม่เพิ่ม workbench หรือรูปแบบไฟล์ใหม่

- กด `+` ในหมวด VHDL MODULES หรือข้าง Import Module ใน Components เพื่อเปิด New VHDL Module เขียนหรือวางโค้ด แล้วกด Add Module จากนั้นหยิบกล่องไปต่อใน schematic ได้ คำสั่งเดียวกันอยู่ใน Tools ด้วย
- ดับเบิลคลิกกล่อง VHDL เพื่อเปิด source editor โดยตรง ปุ่ม Source ใน Inspector ยังใช้ได้ ส่วนดับเบิลคลิก schematic ย่อยยังเปิดแผ่นวงจรตามเดิม
- ขยายพื้นที่เขียนโค้ดเฉพาะ editor นี้ตามขนาดหน้าต่าง พื้นที่โค้ดเลื่อนและย่อขยายได้ โดยคงปุ่ม Add/Update/Cancel ใน footer เดิม
- แก้ source แล้วกด Update ใช้กับทุก instance ของ definition นั้น แสดงจำนวนกล่องและผลต่อ interface ใน editor เดิม ค่า generic ของแต่ละกล่องยังแยกกัน การพิมพ์ยังไม่เปลี่ยน source ที่ใช้งานจนกด Update และ Undo คืนการเปลี่ยนได้
- โค้ดที่สร้าง/แก้เก็บในโปรเจกต์และติดไปกับ Save Workspace ใช้ข้อจำกัด interface/dependency ของ VHDL module เดิม ไม่เพิ่ม compiler หรืออ้างว่าการรับ source เข้าแอปเท่ากับ synthesis ผ่าน
- ตรวจเฉพาะส่วนที่เกี่ยวข้อง **74/74** ไม่มี skip รวม regression ใหม่ 3 กรณี: การเปิด source ผ่าน double-click, สร้าง source และ Undo/Redo/save/load, กับ invalid draft/Cancel ผ่าน UI จริงสร้าง `demo_box`, วาง WIDTH=64, ดับเบิลคลิกแก้ `q <= d` เป็น `q <= not d`, Update แล้วเปิดกลับได้โค้ดใหม่ และ Undo หนึ่งครั้งคืนโค้ดเดิม [ภาพ source editor](../output/vhdl-authoring-2026-10-20/source-editor.png)
- หลังขยายพื้นที่ editor ตรวจ UX-D ซ้ำเฉพาะชุด **21/21** และเปิดหน้าใหม่ผ่าน UI source ยังอยู่ครบ [ผลตรวจ](../output/vhdl-authoring-2026-10-20/checks.json) ไฟล์โมดูลเดิมทั้ง 220 ไฟล์ไม่เปลี่ยน

### Source ใน Inspector และคืนปุ่ม Generate — 2026-10-21

- ดับเบิลคลิกกล่อง VHDL หรือกด Source เปิดโค้ดใน Inspector ด้านข้าง แก้แล้วกด Update ตรงนั้นได้ ใช้ parser, ผลกระทบต่อ interface และ transaction เดิม
- เก็บ draft แยกตาม definition ในโปรเจกต์ระหว่าง session สลับเลือกชิ้นส่วนแล้วกลับมาแก้ต่อได้ การพิมพ์ยังไม่แก้ source ที่วงจรใช้ ส่วน Cancel ทิ้ง draft และกลับไปค่าของชิ้นส่วน Update ยังอยู่ใน panel และ Undo คืน source/ค่าพอร์ต/สายร่วมกัน
- รักษาตำแหน่ง cursor กับ scroll ของช่องโค้ดเมื่อ Inspector วาดใหม่ ใช้ขอบปรับความกว้าง sidebar เดิม พื้นที่โค้ดเลื่อนแนวนอนได้
- ปุ่มด้านบนกลับเป็น Generate VHDL กดแล้วเปิดแท็บโค้ด ปุ่ม `.vhd` ในแท็บใช้ดาวน์โหลดตามเดิม
- ตรวจเฉพาะส่วนที่เกี่ยวข้อง **59/59** ไม่มี skip: UX-D, UX-A และ VHDL generics รวมกรณี draft/Cancel, shared-source Update/Undo และ stale plan ผ่าน UI จริงทั้งเปิด source โดยไม่มี modal, สลับ selection แล้ว draft ยังอยู่, Update, invalid-source Cancel, Undo และ Generate เปิดโค้ดที่อัปเดตแล้ว [ภาพ Inspector](../output/inspector-vhdl-2026-10-21/inspector-source.png) · [ภาพ Generate](../output/inspector-vhdl-2026-10-21/generate-vhdl.png)

### VHDL syntax highlighting — 2026-10-21

- Inspector source now colors keywords, types, comments, strings and numbers in both themes. A painted layer follows the existing textarea; editing, selection, native Undo and source Update keep their existing behavior. No editor dependency or new controls.
- Generate VHDL shares the tokenizer and theme colors. Tokenization escapes source and protects comments/strings before coloring keywords; raw source and downloaded VHDL remain unchanged.
- Focused tests passed **62/62** with no skips (UX-D, UX-A and VHDL generics). Browser checks covered typing/native Undo, horizontal and vertical scrolling of an 81-line source, Update, both themes and returning from Generate to Inspector. [Light theme](../output/vhdl-syntax-2026-10-21/inspector-light.png) · [Dark theme](../output/vhdl-syntax-2026-10-21/inspector-dark.png).

### Editor, draft recovery and pairwise wiring — delivered 2026-10-21

Authorized scope: items 1–3 only. Keep the static application and existing file/module contracts; no compiler integration or new dependency.

1. Share the highlighted VHDL editor between New VHDL and Inspector. Add line numbers, Tab/Shift+Tab, automatic indentation, and a collapsed literal Find/Replace panel. Preserve text selection, native text Undo and source Update/Cancel.
2. Persist uncommitted source separately in browser storage, keyed by project and module with its original source. Reopen matching drafts automatically; never apply them to the circuit. Explicit Cancel discards, successful Add/Update clears. New-module drafts recover too; storage failures remain visible without blocking typing.
3. For two selected components, show an Inspector action to map source outputs to destination inputs. Suggest unique same-name/same-width ports, allow manual mapping and direction swap, retain occupied inputs, revalidate before connecting, and commit the batch with one Undo. Reuse existing branching and local routing.

Verification: **146/146** focused tests passed, no skips (editor/recovery/pairing, UX-D, multi-wire, UX-A, generics, parameter changes and resize). Browser checks passed for both editors, draft recovery after actual reload, Update/Cancel, native text Undo, Find/Replace with Undo, multiline indent/outdent, both themes and fixed line numbers while scrolling a 130-line source horizontally and vertically. Inspector source updates now ignore generated net caches when detecting stale plans; real circuit changes still invalidate them.

The browser connected `clk`, `rst` and a 64-bit `data` bus in one action; one Undo restored zero wires and Redo restored all three. Manual mapping, direction swap and Cancel were also exercised. The generated browser VHDL passed GHDL analysis and elaboration; its linker reported the existing macOS target-version warning. This was not a board run or compiler integration feature. [Source editor](../output/editor-recovery-pairs-2026-10-21/source-editor.png) · [Pair mapping](../output/editor-recovery-pairs-2026-10-21/pair-preview.png) · [Checks](../output/editor-recovery-pairs-2026-10-21/checks.json).

Drafts stay in browser storage separately from saved/exported circuits. Cancel discards and successful Add/Update clears them; reopening a source restores only a draft matching the project, module and original source. No dependency or project-file format was added.

### UX-E — ตรวจ flow รวมและเก็บ diff ให้เล็ก

- ใช้โปรเจกต์ตัวอย่างทดสอบตั้งแต่ import → หา/วาง → ตั้งค่า → ต่อสาย → Check → ดาวน์โหลด `.vhd` จริง → save/reopen ให้ค่ากับ source ยังอยู่ครบ ไม่ใช้ผล toast แทนการตรวจไฟล์
- ทดสอบทั้งเริ่มใหม่และโปรเจกต์ที่มีโมดูลแล้ว ข้อมูลผิด/ขาด/ซ้ำ/conflict การยกเลิก และ Undo/Redo ของแต่ละ transaction ตามเกณฑ์ UX-A ถึง UX-D
- เพิ่ม flow อุปกรณ์พื้นฐาน: ค้นหา/วางซ้ำ, ย้ายเดี่ยวและกลุ่ม, duplicate, ต่อบัสขนาดตรง/ผิด/ทับสายเดิม, fan-out, sweep clock หลายขา, I/O Marker ที่รับขนาดพอร์ต และเข้า/ออก schematic ย่อยสอง instance รวมลบ/เปลี่ยนพอร์ตที่ parent ใช้ ต้องรักษาเครื่องมือที่ใช้งานได้อยู่แล้ว ไม่สร้างตัวช่วยชุดใหม่มาซ้ำ
- รันทดสอบที่เกี่ยวข้องจากชุดเดิม: VHDL generator, import/generics, parameter changes, component resize, project import/persistence และ wiring/bus เมื่อแก้จุดร่วม เพิ่ม regression เฉพาะพฤติกรรมที่เปลี่ยน โดยเฉพาะ export เก่าและ transaction ที่อาจทำสายหาย
- ใช้ `node --test --test-concurrency=1` สำหรับชุดที่เรียก GHDL ไม่เพิ่ม framework หรือ dependency ใหม่ ถ้าจุดที่แก้กระทบ generation/ports/routing ร่วม ให้ขยายชุดทดสอบตามขอบเขตนั้น
- ตรวจ browser จริงเรื่อง file picker, การหาโมดูลหลังนำเข้า, focus, resize และ download แล้วเปรียบเทียบไฟล์ที่ได้กับวงจรล่าสุด การตรวจดิจิทัลครั้งนี้ไม่ใช้แทนการทดสอบบอร์ด
- ตรวจ native browser zoom 125% ที่ยังค้างจาก UX-B โดยยืนยัน zoom จริงก่อนทดสอบ Inspector และ Apply/error
- ตรวจ UX-C ที่ยังค้างผ่าน native picker: raw VHDL 49 ไฟล์, LCD controller → เพิ่ม writer, duplicate/conflict และยกเลิก picker โดยตรวจโปรเจกต์กับ Undo จริง แยกผลนี้จาก tests ที่จำลองการส่งไฟล์
- เปรียบเทียบ diff ว่าแตะเฉพาะ UX ที่ระบุ คงโมดูลทั้ง 49 ตัว ไฟล์เดิม 1–64 bit, enable, wiring helpers, manual routes, layout lock และ saved-project compatibility ไม่เปลี่ยน logic ของ lab

ผลตรวจ UX-E — 2026-10-20:

- พบว่า Fit ใช้ key ของแผ่นไม่ตรงกับระบบจำมุมมองรายโปรเจกต์ ทำให้สลับกลับมาแล้วคืน pan/zoom เก่าก่อน Fit แก้หนึ่งบรรทัดให้ใช้ key เดียวกัน และเพิ่ม regression ที่สลับ/ปิดแท็บ
- [regression UX-E](../schematic2vhdl-v2/ux-e.test.js) ตรวจ raw VHDL 49 ไฟล์ → ตั้งค่า/วาง 64 บิต → I/O Marker → resize → save/load → duplicate/Undo → export ชื่อล่าสุด พร้อม GHDL simulation ชุดรวมผ่าน **733/733** ไม่มี skip การส่งไฟล์ใน tests ยังเป็น file transport จำลอง
- ผ่าน UI จริง: นำเข้า source ของ `ss_bus_reverse` ด้วยคำสั่ง paste รอง ค้นหา วาง WIDTH=64 และติด I/O Marker ได้ 3 components / 2 wires; Check ได้ 0 errors / 0 warnings [ภาพวงจร](../output/ux-e-2026-10-20/64-bit-circuit.png)
- ตรวจ [VHDL ที่ดาวน์โหลดจริง](../output/ux-e-2026-10-20/browser-export.vhd) แล้ว ชื่อ top, generic 64 และ source ตรงกับวงจรล่าสุด GHDL compile/elaborate/simulate ผ่าน โดยได้ `F7B3D591E6A2C480` จาก input `0123456789ABCDEF` [ผลตรวจ](../output/ux-e-2026-10-20/browser-export-check.json) ตัว linker มีคำเตือนเวอร์ชัน macOS แต่ไม่มีผลให้การจำลองล้มเหลว
- ไฟล์ lab เดิมทั้ง 5 ชุดผ่าน deserialize → serialize → deserialize → serialize โดยผลรอบถัดไปตรงกัน ต้นฉบับไม่เปลี่ยน [หลักฐาน](../output/ux-e-2026-10-20/legacy-projects.json) เป็นผลของตัวอ่าน/เขียนข้อมูล ยังไม่ใช่การเปิดทั้งห้าชุดผ่าน native picker หรือทดสอบ logic ของ lab ใหม่
- Native picker เปิดและ Cancel กลับได้ แต่การเลือกเปิดไฟล์ยังไม่สำเร็จผ่านเครื่องมือ; ช่อง browser zoom ไม่ให้ผลที่ยืนยัน 125% ได้ การ Save Workspace ยังไม่ยืนยันไฟล์/เปิดกลับจริง จึงไม่ปิดเกณฑ์เหล่านี้
- ผู้ใช้ขอทดสอบหน้าต่างระบบเอง ให้หยุดควบคุมและเตรียม [รายการทดสอบพร้อมผลที่ควรเห็น](UX_MANUAL_TESTS.md) ไว้แล้ว ยังไม่ถือว่า UX-E จบครบทุกเกณฑ์
- คำขอล่าสุด: ผู้ใช้เห็นว่าไม่จำเป็นต้องทดสอบละเอียดเท่านี้และให้ทำงานอื่นต่อ จึงจบรอบตรวจตามขอบเขตที่เลือก รายการที่ยังไม่ได้ตรวจเก็บเป็นข้อมูลอ้างอิง ไม่ใช้ checklist เป็นเงื่อนไขขวางงานต่อ และไม่เปลี่ยนผลเหล่านั้นเป็นผ่าน

ไฟล์ทำงานหลักของ v2 คือ `schematic2vhdl-v2/index.html` และ tests ที่เกี่ยวข้อง ไม่มีการย้าย framework หรือรื้อสถาปัตยกรรม งานพัฒนาตามแผนและการสร้าง/แก้ VHDL ที่ขอเพิ่มส่งมอบแล้ว การตรวจเพิ่มเติมทำเมื่อมีปัญหาจริงหรือผู้ใช้ขอ


### Separate original and v2 — 2026-10-21

- Copied and verified the complete enhanced source, test harness, tests, CLI helpers, examples and fixtures before restoring the original HTML. Historical alternate HTML/report files remain in the original directory. All 21 untracked enhancement-test files moved to v2 after matching their copies.
- The v2 application differs from the pre-split source only in the visible version label and storage namespace. Autosave, theme, wire-hop preference, sidebar sizes and source drafts use `schstudio.v2.*`. Portable `schstudio-custom-pkg` and project formats retain their identity. No automatic storage migration occurs; use Save Workspace/Open to transfer existing work.
- Dashboard entries preserve the old URL and shortcuts; Alt+6 opens v2. The optional local Sites build includes both routes and returns both pages successfully. No deployment ran.
- CLI docs, current component reference, manual-check link and current plan target v2. The original reference regression reads a frozen GitHub-era catalog so current v2 metadata cannot change its expected behavior.
- The original suite passed **104/104**, the v2 application suite passed **760/760**, and four focused version-isolation checks passed. Application results were separated from the 38 inactive generator cases in the combined log. Browser checks on one origin retained 8 components in Original and 9 in v2, independent dark/light preferences, and a v2 VHDL draft across reload; module creation, placement and the Inspector source editor also worked from the new URL.
- The broad validation accidentally included the inactive Python generator's tests. Ten wrap-counter cases failed there. A representative failing case was reproduced with the unmodified enhanced source from before this split (same assertion at 13 ns). That inactive draft generator is outside the module catalog and this change; no generator logic was changed. Its results are recorded separately from the application suites.
- [Verification evidence](../output/version-split-2026-10-21/checks.json) and [dashboard](../output/version-split-2026-10-21/dashboard.png). External module files were not changed.

### New VHDL starter — 2026-10-21

- New VHDL in v2 starts with IEEE `std_logic`, an entity with `d`/`q` ports, and an `rtl` architecture driving `q <= d`. Existing drafts take priority. Opening the editor does not create a module; Add Module retains the existing import/Undo flow.
- Generated names avoid existing schematic/entity and supporting package names, using `new_module`, `new_module_2`, etc. No extra settings or dialogs were added.
- Focused editor/recovery/isolation tests passed **48/48**. GHDL analysis and elaboration of the generated starter passed; the linker reported its existing macOS version warning. Browser checks confirmed the populated highlighted editor, Add Module, and the next unique name. The original HTML remained byte-for-byte unchanged. [Evidence](../output/vhdl-starter-2026-10-21/checks.json) · [Editor](../output/vhdl-starter-2026-10-21/new-vhdl.png).

### VHDL bundle import — approved 2026-10-21

1. Read design units from single/multi-entity VHDL files, retain their source/context clauses, and resolve entity/package dependencies. Keep ordinary single-module import direct.
2. Reuse the Components import panel for three outcomes: selected VHDL modules, one selected root module, or stamped schematics. Default to roots, allow Select all, and bring required dependencies automatically without adding their tiles. Missing files remain recoverable; conflicting sources never overwrite existing definitions.
3. Restore stamped schematics through the project importer, including custom modules, layout and hierarchy. Stage the full batch before changing the project and retain one-step Undo/Redo. Preserve original/v2 isolation.
4. Verify selection/dependencies, package/source preservation, cancellation/conflicts, source editing, persistence, export and Undo. Exercise the two supplied legacy bundles in both relevant representations and a small external bundle with GHDL. Check the panel in the browser; avoid unrelated hardware/native-picker testing.

Delivered:

- Multi-entity files and entity/architecture/package-body files can be selected together. The import panel offers selected modules, one root box, or stamped schematics. Selected modules appear in Components and Project → USE AS SUB-BLOCK, using the same click/drag placement controls; required dependencies remain stored and export with the root. The Inspector source selector also opens those dependencies for editing.
- The ordinary one-module picker remains direct. Multi-module import waits for one Import action in the existing panel. Select all/none, missing-file recovery, Cancel and source-conflict recovery retain the file queue. Equivalent code with different comments, whitespace or identifier case skips without replacing stored source/metadata; literals remain significant.
- Stamped restore now includes custom definitions and validates the complete batch through the existing project importer. Positions/hierarchy/wires remain intact, names/IDs use its existing collision rules, and Undo/Redo covers the operation. The older Import VHDL as Schematic command shares this restore path.
- Relevant regressions passed **196/196**, including GHDL tests; the last selection-control adjustment passed its focused **28/28** checks. [Legacy-file checks](../output/vhdl-bundle-import-2026-10-21/legacy-checks.json) verify both real bundles as one visible module with complete dependency export and GHDL analysis/elaboration, and as 14/16 restored schematics with positions, custom source, Undo/Redo and workspace persistence. A mixed selection from both files imported only four required entities for two visible modules.
- Browser file selection verified countdown as one box, the Inspector dependency selector, two selected submodules, and lab10 restore with `ss_unary` surviving reload. A source-editor fix preserves a leading blank line rather than showing a false edit on opening split source. [Selection UI](../output/vhdl-bundle-import-2026-10-21/selected-submodules.png) · [Single box](../output/vhdl-bundle-import-2026-10-21/single-module.png) · [Restored lab10](../output/vhdl-bundle-import-2026-10-21/restored-lab10.png).
- No new dependencies, module-artifact changes, original-app changes, commit, push or deployment. Existing interface constraints remain: in/out logic/vector/signed/unsigned ports, 1–64-bit widths, bounded integer generics and one architecture per entity. Schematic restore requires embedded drawing data; arbitrary VHDL is not reverse-compiled into a drawing.
