# Built-in component reference

Generated from Studio TYPES, paramSchema and getPorts. Regenerate with `node schematic2vhdl/generate-schematic-text-reference.cjs`. Do not hand-edit the generated tables.

Pin notation: `id:in[width]` or `id:out[width]`. Listed variants change ONE setting from defaults; combined settings must be queried using `describe-schematic-part.cjs`. BUSTAP d width 2 is a drawing marker: see syntax.md for actual bus width and merge direction.

Contents: VCC, GND, CONST, AND, OR, NAND, NOR, XOR, XNOR, NOT, BUF, MUX, DEMUX, COMP, COMPM, BUSTAP, ENC, DEC, DFF, JKFF, TFF, SRFF

## VCC

Defaults: `{}`

Pins: `o:out[1]`


## GND

Defaults: `{}`

Pins: `o:out[1]`


## CONST

Defaults: `{"value":"00","width":8}`

Pins: `o:out[8]`

| Parameter | Accepted values |
|---|---|
| value | string |
| width | integer 1…32 |


## AND

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…32 |


## OR

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…32 |


## NAND

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…32 |


## NOR

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…32 |


## XOR

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…32 |


## XNOR

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…32 |


## NOT

Defaults: `{"inputs":1,"width":1}`

Pins: `i0:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| width | integer 1…32 |


## BUF

Defaults: `{"inputs":1,"width":1}`

Pins: `i0:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| width | integer 1…32 |


## MUX

Defaults: `{"inputs":2,"width":1,"selectMode":"pins"}`

Pins: `d0:in[1] d1:in[1] s0:in[1] y:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | 2, 4, 8, 16 |
| width | integer 1…32 |
| selectMode | pins, bus |

- `inputs=4` → `d0:in[1] d1:in[1] d2:in[1] d3:in[1] s0:in[1] s1:in[1] y:out[1]`
- `inputs=8` → `d0:in[1] d1:in[1] d2:in[1] d3:in[1] d4:in[1] d5:in[1] d6:in[1] d7:in[1] s0:in[1] s1:in[1] s2:in[1] y:out[1]`
- `inputs=16` → `d0:in[1] d1:in[1] d2:in[1] d3:in[1] d4:in[1] d5:in[1] d6:in[1] d7:in[1] d8:in[1] d9:in[1] d10:in[1] d11:in[1] d12:in[1] d13:in[1] d14:in[1] d15:in[1] s0:in[1] s1:in[1] s2:in[1] s3:in[1] y:out[1]`
- `selectMode=bus` → `d0:in[1] d1:in[1] s:in[1] y:out[1]`

## DEMUX

Defaults: `{"outputs":2,"inputMode":"pins","outputMode":"pins","width":1,"selectMode":"pins"}`

Pins: `d:in[1] s0:in[1] y0:out[1] y1:out[1]`

| Parameter | Accepted values |
|---|---|
| outputs | 2, 4, 8, 16 |
| inputMode | pins, bus |
| outputMode | pins, bus |
| width | integer 1…32 |
| selectMode | pins, bus |

- `outputs=4` → `d:in[1] s0:in[1] s1:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1]`
- `outputs=8` → `d:in[1] s0:in[1] s1:in[1] s2:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1]`
- `outputs=16` → `d:in[1] s0:in[1] s1:in[1] s2:in[1] s3:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] y8:out[1] y9:out[1] y10:out[1] y11:out[1] y12:out[1] y13:out[1] y14:out[1] y15:out[1]`
- `selectMode=bus` → `d:in[1] s:in[1] y0:out[1] y1:out[1]`

## COMP

Defaults: `{"width":2,"pinMode":"pins"}`

Pins: `a0:in[1] a1:in[1] b0:in[1] b1:in[1] eq:out[1]`

| Parameter | Accepted values |
|---|---|
| width | 2, 4, 8, 16 |
| pinMode | pins, bus |

- `width=4` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] b0:in[1] b1:in[1] b2:in[1] b3:in[1] eq:out[1]`
- `width=8` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] a4:in[1] a5:in[1] a6:in[1] a7:in[1] b0:in[1] b1:in[1] b2:in[1] b3:in[1] b4:in[1] b5:in[1] b6:in[1] b7:in[1] eq:out[1]`
- `width=16` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] a4:in[1] a5:in[1] a6:in[1] a7:in[1] a8:in[1] a9:in[1] a10:in[1] a11:in[1] a12:in[1] a13:in[1] a14:in[1] a15:in[1] b0:in[1] b1:in[1] b2:in[1] b3:in[1] b4:in[1] b5:in[1] b6:in[1] b7:in[1] b8:in[1] b9:in[1] b10:in[1] b11:in[1] b12:in[1] b13:in[1] b14:in[1] b15:in[1] eq:out[1]`
- `pinMode=bus` → `a:in[2] b:in[2] eq:out[1]`

## COMPM

Defaults: `{"width":2,"pinMode":"pins"}`

Pins: `a0:in[1] a1:in[1] b0:in[1] b1:in[1] gt:out[1] lt:out[1]`

| Parameter | Accepted values |
|---|---|
| width | 2, 4, 8, 16 |
| pinMode | pins, bus |

- `width=4` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] b0:in[1] b1:in[1] b2:in[1] b3:in[1] gt:out[1] lt:out[1]`
- `width=8` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] a4:in[1] a5:in[1] a6:in[1] a7:in[1] b0:in[1] b1:in[1] b2:in[1] b3:in[1] b4:in[1] b5:in[1] b6:in[1] b7:in[1] gt:out[1] lt:out[1]`
- `width=16` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] a4:in[1] a5:in[1] a6:in[1] a7:in[1] a8:in[1] a9:in[1] a10:in[1] a11:in[1] a12:in[1] a13:in[1] a14:in[1] a15:in[1] b0:in[1] b1:in[1] b2:in[1] b3:in[1] b4:in[1] b5:in[1] b6:in[1] b7:in[1] b8:in[1] b9:in[1] b10:in[1] b11:in[1] b12:in[1] b13:in[1] b14:in[1] b15:in[1] gt:out[1] lt:out[1]`
- `pinMode=bus` → `a:in[2] b:in[2] gt:out[1] lt:out[1]`

## BUSTAP

Defaults: `{"bit":0,"nbit":1,"dir":"right","mode":"split","order":"up","skipUsed":true}`

Pins: `d:in[2] y:out[1]`

| Parameter | Accepted values |
|---|---|
| bit | integer 0…31 |
| nbit | integer 1…32 |
| mode | split, merge |
| dir | right, down, left, up |
| order | up, down |
| skipUsed | true, false |

- `mode=merge` → `d:in[2] y:in[1]`

## ENC

Defaults: `{"inputs":4,"inputMode":"pins","outputMode":"pins"}`

Pins: `i0:in[1] i1:in[1] i2:in[1] i3:in[1] y0:out[1] y1:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | 4, 8, 16 |
| inputMode | pins, bus |
| outputMode | pins, bus |

- `inputs=8` → `i0:in[1] i1:in[1] i2:in[1] i3:in[1] i4:in[1] i5:in[1] i6:in[1] i7:in[1] y0:out[1] y1:out[1] y2:out[1]`
- `inputs=16` → `i0:in[1] i1:in[1] i2:in[1] i3:in[1] i4:in[1] i5:in[1] i6:in[1] i7:in[1] i8:in[1] i9:in[1] i10:in[1] i11:in[1] i12:in[1] i13:in[1] i14:in[1] i15:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1]`
- `inputMode=bus` → `i:in[4] y0:out[1] y1:out[1]`
- `outputMode=bus` → `i0:in[1] i1:in[1] i2:in[1] i3:in[1] y:out[2]`

## DEC

Defaults: `{"outputs":4,"inputMode":"pins","outputMode":"pins"}`

Pins: `a0:in[1] a1:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] en:in[1]`

| Parameter | Accepted values |
|---|---|
| outputs | 4, 8, 16 |
| inputMode | pins, bus |
| outputMode | pins, bus |

- `outputs=8` → `a0:in[1] a1:in[1] a2:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] en:in[1]`
- `outputs=16` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] y8:out[1] y9:out[1] y10:out[1] y11:out[1] y12:out[1] y13:out[1] y14:out[1] y15:out[1] en:in[1]`
- `inputMode=bus` → `a:in[2] y0:out[1] y1:out[1] y2:out[1] y3:out[1] en:in[1]`
- `outputMode=bus` → `a0:in[1] a1:in[1] y:out[4] en:in[1]`

## DFF

Defaults: `{"edge":"rising","reset":false,"preset":false}`

Pins: `d:in[1] clk:in[1] q:out[1] qn:out[1]`

| Parameter | Accepted values |
|---|---|
| edge | rising, falling |
| reset | true, false |
| preset | true, false |

- `reset=true` → `d:in[1] clk:in[1] rst:in[1] q:out[1] qn:out[1]`
- `preset=true` → `d:in[1] clk:in[1] pre:in[1] q:out[1] qn:out[1]`

## JKFF

Defaults: `{"edge":"rising","reset":false,"preset":false}`

Pins: `j:in[1] k:in[1] clk:in[1] q:out[1] qn:out[1]`

| Parameter | Accepted values |
|---|---|
| edge | rising, falling |
| reset | true, false |
| preset | true, false |

- `reset=true` → `j:in[1] k:in[1] clk:in[1] rst:in[1] q:out[1] qn:out[1]`
- `preset=true` → `j:in[1] k:in[1] clk:in[1] pre:in[1] q:out[1] qn:out[1]`

## TFF

Defaults: `{"edge":"rising","reset":false,"preset":false}`

Pins: `t:in[1] clk:in[1] q:out[1] qn:out[1]`

| Parameter | Accepted values |
|---|---|
| edge | rising, falling |
| reset | true, false |
| preset | true, false |

- `reset=true` → `t:in[1] clk:in[1] rst:in[1] q:out[1] qn:out[1]`
- `preset=true` → `t:in[1] clk:in[1] pre:in[1] q:out[1] qn:out[1]`

## SRFF

Defaults: `{"edge":"rising","reset":false,"preset":false}`

Pins: `s:in[1] r:in[1] clk:in[1] q:out[1] qn:out[1]`

| Parameter | Accepted values |
|---|---|
| edge | rising, falling |
| reset | true, false |
| preset | true, false |

- `reset=true` → `s:in[1] r:in[1] clk:in[1] rst:in[1] q:out[1] qn:out[1]`
- `preset=true` → `s:in[1] r:in[1] clk:in[1] pre:in[1] q:out[1] qn:out[1]`
