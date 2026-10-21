# Schematic Text v1

Canonical specification for the importer in `schematic2vhdl-v2/index.html`.

One file creates one new sheet in the current project. Existing sheets/custom blocks remain shared live references. Import does not change the project's top entity; choose the new top in the Inspector if required. New hierarchy definitions in one file, VHDL expressions, slices, loops, and arbitrary JSON parameters are not supported.

## Grammar

```text
format schematic-text 1
circuit mux_demo
# comments outside quoted strings start with #
input a[8], b[8], sel
output y[8]
part m MUX inputs=2 width=8
connect a -> m.d0
connect b -> m.d1
connect sel -> m.s0
connect m.y -> y
```

The format header is the first non-comment line. Exactly one circuit name is required. Commands and type names are case-sensitive. Identifiers start with an ASCII letter and continue with letters, digits or underscores. Component/port declaration names must be unique ignoring case. Widths are 1–32; omitted width is 1. Names used as VHDL ports/entities should avoid VHDL reserved words, consecutive underscores and trailing underscores.

`part instance TYPE key=value ...` uses the real type defaults and `paramSchema`. Unknown, duplicate, out-of-range parameters are errors. Integers, booleans (`true`/`false`), enumerated choices and JSON-quoted strings are supported. CONST values are hex strings, e.g. `value="F4" width=8`; values that overflow are rejected. Internal JUNCTIONs are generated automatically; IN/OUT use declarations. MODULE_FRAME is not part of this format.

`connect source -> target, target` supports fan-out. Bare input/output names refer to their external connection. Other endpoints require `instance.pin`. All referenced parts must exist, but connect lines can appear before their part declarations. Each ordinary input permits one driver; widths must match exactly (no implicit widening). Unconnected inputs produce warnings, except missing `clk` is an error. Warnings do not prove an intentional or correct circuit.

## Existing subcircuits

```text
use "adder8" as add
# Prefer exact binding with a signature copied from the actual catalog:
# use "SCH:sch123" as add signature "a:in:8,b:in:8,sum:out:8"
part u1 @add
part u2 @add
```

`use` must precede the parts using its alias. A reference may be a unique sheet/custom name, `SCH:<id>`, or `CUSTOM:<key>` in the current project. Quote names with spaces. Ambiguous names, missing dependencies, changed signatures and recursive hierarchy are errors. Signatures encode sorted pin IDs, directions and widths, not implementation behavior. IDs are project-local: recopy the catalog after importing a project elsewhere. The importer never fetches missing libraries. Raw VHDL custom blocks retain the validation limits of existing Studio custom blocks.

## Bus taps

The catalog's BUSTAP d width marker is for drawing, not its actual bus width. The importer derives that width from the connected bus. Ranges must fit; merge ranges cannot overlap or share a bus with a full-width driver.

```text
format schematic-text 1
circuit join_bytes
input lo[4], hi[4]
output y[8]
part l BUSTAP bit=0 nbit=4 mode=merge
part h BUSTAP bit=4 nbit=4 mode=merge
connect lo -> l.y
connect hi -> h.y
connect l.d -> y
connect h.d -> y
```

For splitting, use `mode=split` (default), `connect bus -> tap.d`, then `connect tap.y -> destination`. Each tap must attach to a real-width port, not directly to another tap's d pin. Unfilled merge bits produce a warning. When one assembled bus drives several destinations, connect all its merge taps to each destination so every destination has the complete set of slices.

## Validation and limits

Maximum text size 250,000 characters, 1,000 declared components and 5,000 connection statements. Validation uses temporary circuit objects and reports the first error with its line. The importer validates again when committing; on success it gives fresh IDs, handles name collisions, lays out components and normalizes fan-out. Undo removes the import as one action.

The AI catalog lists ports at default parameters; changed parameters may change pin names/widths. Query the real registry/parser when using non-default parts. Successful structural validation is not synthesis, timing closure, simulation, or physical-board proof.
