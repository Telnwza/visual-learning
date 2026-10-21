---
name: schematic-text-author
description: Create compact Schematic Text circuits for Schematic Studio, including reuse of existing subcircuits from a supplied AI catalog. Use when asked to generate .sch.txt files or circuits for the Schematic Text importer; not for arbitrary VHDL conversion.
---

# Schematic Text author

Use these references according to the circuit being requested:
- Read [the v1 syntax](references/syntax.md) for every new circuit.
- Look up relevant types in [the generated component reference](references/components.md). It includes every supported built-in, defaults, accepted parameters and pin-changing variants.
- Read [tested examples and sequential design notes](references/examples.md) for gate, bus, clock/reset, counter or subcircuit patterns. Complete `.sch.txt` templates are in `assets/`.
- Use [diagnostics and validation commands](references/troubleshooting.md) when checking or correcting output.

## Authoring workflow

1. Identify input/output widths, intended behavior, clock/reset rules and any existing subcircuit dependencies. Ask only for missing information that materially affects the requested circuit.
2. Choose actual supported parts and work out equations or a state transition table. No built-in counter, register, FSM or adder should be invented.
3. Confirm exact configured pins. When parameters change, use `node schematic2vhdl-v2/describe-schematic-part.cjs TYPE key=value ...` from the checkout. For example, `MUX inputs=4 width=8 selectMode=bus` has a 2-bit s pin, not s0/s1. Reference variants change one setting at a time; query combinations.
4. Write the header, circuit name, library bindings, I/O declarations, parts, then connections. Keep library aliases before their instances. Use simple distinct ASCII names and make bus splits/merges explicit.
5. Run the checker, fix each error, re-run, and resolve or explain warnings. For sequential or arithmetic designs, use a behavioral testbench when available and appropriate. Never treat parse success as behavior proof.
6. Return the `.sch.txt` artifact and concise usage/verification details.

Read [the v1 syntax](references/syntax.md) before producing a circuit. Create a `.sch.txt` file that the user can paste into Tools → Import Schematic Text.

Use the current Studio AI catalog for available component parameters and subcircuit ports. Ask for missing subcircuit interfaces and behavior when the requested design depends on them. A name or port list alone does not establish the block's behavior. Preserve the catalog's exact `use` reference and `signature`; change only its local alias as needed. Do not invent missing blocks or silently replace them with a different implementation.

Prefer native parts and live subcircuit instances. Do not emit project IDs for new components, coordinates, routing points or project JSON. For unsupported operations, compose supported parts; if that is not possible, explain the specific missing capability.

When the Studio checkout is available, validate with its actual parser:

```sh
node /path/to/visual-learning/schematic2vhdl-v2/check-schematic-text.cjs circuit.sch.txt [project.schproj.json] [workspace-project-id]
```

Resolve the checkout from the current workspace or user context; do not assume a fixed machine path. Existing subcircuits require the actual project export for CLI validation, or validation in the destination Studio project. Fix errors, and explain intentional unconnected input warnings. The CLI validates structure; it does not simulate behavior or validate all logic inside supplied subcircuits. Use GHDL/testbenches for behavior when warranted and available, and state precisely what was checked.

Return the file and a short account of inputs, outputs, clock/reset behavior, overflow/truncation, required existing blocks, and meaningful verification limits. Do not send project data to external AI services; the catalog is provided to the user for their own workflow.
