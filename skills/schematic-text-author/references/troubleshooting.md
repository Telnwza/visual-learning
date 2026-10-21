# Diagnostics and corrections

The importer reports the first error. Fix its cause and re-run validation; do not delete functional parts merely to silence the message. The line number refers to the original text, including blank/comment lines.

| Problem | Wrong example | Correction |
|---|---|---|
| Missing header / unknown version | `format schematic-text 2` | Use exactly `format schematic-text 1` as the first non-comment line |
| Unknown part | `part r REGISTER` | Build from DFFs, or bind a real register via `use` then `part r @reg` |
| Unknown parameter | `part f DFF width=8` | DFF is 1 bit; use 8 DFFs or an existing block |
| Unknown pin | `connect a -> g.a` for AND | Query AND; use g.i0 or g.i1 |
| Port changed by mode | MUX selectMode=bus with m.s0 | Query configured MUX; bus select is m.s |
| Wrong direction | `connect out -> gate.i0` | Bare output ports are sinks; connect a real source to them |
| Width mismatch | input a[8] connected to 1-bit input | Choose matching part width or explicitly split bits; do not silently truncate |
| Duplicate driver | Two ordinary sources → y | Use a MUX or defined combining logic; only disjoint merge slices may share a bus destination |
| Missing subcircuit | `use guessed_name as add` | Obtain current catalog and bind the actual block |
| Ambiguous subcircuit name | Two sheets/customs have the same name | Use the exact SCH/CUSTOM reference from the catalog |
| Changed signature | Stored signature differs from current ports | Refresh catalog and reassess connections; do not simply remove signature |
| Recursive hierarchy | A uses B which uses A | Redesign hierarchy; legal DFF feedback is a different kind of connection |
| Missing clk | DFF with only d wired | Declare and connect the intended clock to every flip-flop |
| Slice outside bus | bit=6 nbit=4 on an 8-bit bus | For upper nibble use bit=4 nbit=4 |
| Overlapping merge | Two 4-bit taps begin at bit=0 | Assign disjoint ranges, e.g. 0 and 4 for an 8-bit result |
| Constant overflow | CONST value="FF" width=4 | Use value="F" if 15 is intended; otherwise increase width and check sinks |
| Sanitized name collision | input a__b, a_b | Choose distinct identifiers that stay distinct after VHDL normalization |
| Malformed quoted string | JSON-invalid escapes | Use JSON string quoting; simple hex strings need no escapes |

## Warnings

An unconnected input is allowed structurally but can produce fallback logic. Supply intended constants using VCC, GND or CONST, or explicitly explain why a pin is unused. Partial merge buses need all intended bit slices connected. Do not equate a warning-only validation result with a complete circuit.

## Validation workflow

From a Studio checkout, discover exact non-default pins before wiring:

```sh
node schematic2vhdl-v2/describe-schematic-part.cjs MUX inputs=4 width=8 selectMode=bus
node schematic2vhdl-v2/describe-schematic-part.cjs DFF reset=true
node schematic2vhdl-v2/check-schematic-text.cjs /path/to/design.sch.txt
node schematic2vhdl-v2/check-schematic-text.cjs /path/to/design.sch.txt /path/to/project.schproj.json
```

These are terminal commands, not lines to paste into the circuit. If the exported workspace has several projects, append the intended workspace project ID as the final argument to the checker; otherwise it uses the saved active project. The checker reads but does not modify the project export. Exit 0 means structural success; warnings appear in JSON. Exit 1 means failure and an error is printed to stderr.

Without a checkout, use the bundled component reference and supply the file for Studio validation. Report that execution was not performed. Do not claim successful import or GHDL simulation based only on reading syntax.
