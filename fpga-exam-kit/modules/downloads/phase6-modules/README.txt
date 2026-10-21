Phase 6 FPGA modules

Read PHASE6.md for wiring, parameters and timing.
Category import packs: packs/. Individual VHDL/package pairs: timing/, bus/, lookup/.
Import category packs OR individual packages through Tools > Import Component Package. Do not import the same module twice.
Raw .vhd files also work; explicitly wire every input.
Examples: examples/. Import needed modules first, paste Schematic Text and select the imported sheet as Top entity before generating VHDL.

Local GHDL and Studio checks completed; no Vivado timing or board validation.
