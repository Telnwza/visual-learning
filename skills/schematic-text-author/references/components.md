# Built-in component reference

Generated from Studio TYPES, paramSchema and getPorts. Regenerate with `node schematic2vhdl-v2/generate-schematic-text-reference.cjs`. Do not hand-edit the generated tables.

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
| width | integer 1…64 |


## AND

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…64 |


## OR

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…64 |


## NAND

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…64 |


## NOR

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…64 |


## XOR

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…64 |


## XNOR

Defaults: `{"inputs":2,"width":1}`

Pins: `i0:in[1] i1:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | integer 2…8 |
| width | integer 1…64 |


## NOT

Defaults: `{"inputs":1,"width":1}`

Pins: `i0:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| width | integer 1…64 |


## BUF

Defaults: `{"inputs":1,"width":1}`

Pins: `i0:in[1] o:out[1]`

| Parameter | Accepted values |
|---|---|
| width | integer 1…64 |


## MUX

Defaults: `{"inputs":2,"width":1,"selectMode":"pins"}`

Pins: `d0:in[1] d1:in[1] s0:in[1] y:out[1]`

| Parameter | Accepted values |
|---|---|
| inputs | 2, 4, 8, 16, 32, 64 |
| width | integer 1…64 |
| selectMode | pins, bus |

- `inputs=4` → `d0:in[1] d1:in[1] d2:in[1] d3:in[1] s0:in[1] s1:in[1] y:out[1]`
- `inputs=8` → `d0:in[1] d1:in[1] d2:in[1] d3:in[1] d4:in[1] d5:in[1] d6:in[1] d7:in[1] s0:in[1] s1:in[1] s2:in[1] y:out[1]`
- `inputs=16` → `d0:in[1] d1:in[1] d2:in[1] d3:in[1] d4:in[1] d5:in[1] d6:in[1] d7:in[1] d8:in[1] d9:in[1] d10:in[1] d11:in[1] d12:in[1] d13:in[1] d14:in[1] d15:in[1] s0:in[1] s1:in[1] s2:in[1] s3:in[1] y:out[1]`
- `inputs=32` → `d0:in[1] d1:in[1] d2:in[1] d3:in[1] d4:in[1] d5:in[1] d6:in[1] d7:in[1] d8:in[1] d9:in[1] d10:in[1] d11:in[1] d12:in[1] d13:in[1] d14:in[1] d15:in[1] d16:in[1] d17:in[1] d18:in[1] d19:in[1] d20:in[1] d21:in[1] d22:in[1] d23:in[1] d24:in[1] d25:in[1] d26:in[1] d27:in[1] d28:in[1] d29:in[1] d30:in[1] d31:in[1] s0:in[1] s1:in[1] s2:in[1] s3:in[1] s4:in[1] y:out[1]`
- `inputs=64` → `d0:in[1] d1:in[1] d2:in[1] d3:in[1] d4:in[1] d5:in[1] d6:in[1] d7:in[1] d8:in[1] d9:in[1] d10:in[1] d11:in[1] d12:in[1] d13:in[1] d14:in[1] d15:in[1] d16:in[1] d17:in[1] d18:in[1] d19:in[1] d20:in[1] d21:in[1] d22:in[1] d23:in[1] d24:in[1] d25:in[1] d26:in[1] d27:in[1] d28:in[1] d29:in[1] d30:in[1] d31:in[1] d32:in[1] d33:in[1] d34:in[1] d35:in[1] d36:in[1] d37:in[1] d38:in[1] d39:in[1] d40:in[1] d41:in[1] d42:in[1] d43:in[1] d44:in[1] d45:in[1] d46:in[1] d47:in[1] d48:in[1] d49:in[1] d50:in[1] d51:in[1] d52:in[1] d53:in[1] d54:in[1] d55:in[1] d56:in[1] d57:in[1] d58:in[1] d59:in[1] d60:in[1] d61:in[1] d62:in[1] d63:in[1] s0:in[1] s1:in[1] s2:in[1] s3:in[1] s4:in[1] s5:in[1] y:out[1]`
- `selectMode=bus` → `d0:in[1] d1:in[1] s:in[1] y:out[1]`

## DEMUX

Defaults: `{"outputs":2,"inputMode":"pins","outputMode":"pins","width":1,"selectMode":"pins"}`

Pins: `d:in[1] s0:in[1] y0:out[1] y1:out[1]`

| Parameter | Accepted values |
|---|---|
| outputs | 2, 4, 8, 16, 32, 64 |
| inputMode | pins, bus |
| outputMode | pins, bus |
| width | integer 1…64 |
| selectMode | pins, bus |

- `outputs=4` → `d:in[1] s0:in[1] s1:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1]`
- `outputs=8` → `d:in[1] s0:in[1] s1:in[1] s2:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1]`
- `outputs=16` → `d:in[1] s0:in[1] s1:in[1] s2:in[1] s3:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] y8:out[1] y9:out[1] y10:out[1] y11:out[1] y12:out[1] y13:out[1] y14:out[1] y15:out[1]`
- `outputs=32` → `d:in[1] s0:in[1] s1:in[1] s2:in[1] s3:in[1] s4:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] y8:out[1] y9:out[1] y10:out[1] y11:out[1] y12:out[1] y13:out[1] y14:out[1] y15:out[1] y16:out[1] y17:out[1] y18:out[1] y19:out[1] y20:out[1] y21:out[1] y22:out[1] y23:out[1] y24:out[1] y25:out[1] y26:out[1] y27:out[1] y28:out[1] y29:out[1] y30:out[1] y31:out[1]`
- `outputs=64` → `d:in[1] s0:in[1] s1:in[1] s2:in[1] s3:in[1] s4:in[1] s5:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] y8:out[1] y9:out[1] y10:out[1] y11:out[1] y12:out[1] y13:out[1] y14:out[1] y15:out[1] y16:out[1] y17:out[1] y18:out[1] y19:out[1] y20:out[1] y21:out[1] y22:out[1] y23:out[1] y24:out[1] y25:out[1] y26:out[1] y27:out[1] y28:out[1] y29:out[1] y30:out[1] y31:out[1] y32:out[1] y33:out[1] y34:out[1] y35:out[1] y36:out[1] y37:out[1] y38:out[1] y39:out[1] y40:out[1] y41:out[1] y42:out[1] y43:out[1] y44:out[1] y45:out[1] y46:out[1] y47:out[1] y48:out[1] y49:out[1] y50:out[1] y51:out[1] y52:out[1] y53:out[1] y54:out[1] y55:out[1] y56:out[1] y57:out[1] y58:out[1] y59:out[1] y60:out[1] y61:out[1] y62:out[1] y63:out[1]`
- `selectMode=bus` → `d:in[1] s:in[1] y0:out[1] y1:out[1]`

## COMP

Defaults: `{"width":2,"pinMode":"pins"}`

Pins: `a0:in[1] a1:in[1] b0:in[1] b1:in[1] eq:out[1]`

| Parameter | Accepted values |
|---|---|
| width | integer 1…64 |
| pinMode | pins, bus |

- `pinMode=bus` → `a:in[2] b:in[2] eq:out[1]`

## COMPM

Defaults: `{"width":2,"pinMode":"pins"}`

Pins: `a0:in[1] a1:in[1] b0:in[1] b1:in[1] gt:out[1] lt:out[1]`

| Parameter | Accepted values |
|---|---|
| width | integer 1…64 |
| pinMode | pins, bus |

- `pinMode=bus` → `a:in[2] b:in[2] gt:out[1] lt:out[1]`

## BUSTAP

Defaults: `{"bit":0,"nbit":1,"dir":"right","mode":"split","order":"up","skipUsed":true}`

Pins: `d:in[2] y:out[1]`

| Parameter | Accepted values |
|---|---|
| bit | integer 0…63 |
| nbit | integer 1…64 |
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
| inputs | 4, 8, 16, 32, 64 |
| inputMode | pins, bus |
| outputMode | pins, bus |

- `inputs=8` → `i0:in[1] i1:in[1] i2:in[1] i3:in[1] i4:in[1] i5:in[1] i6:in[1] i7:in[1] y0:out[1] y1:out[1] y2:out[1]`
- `inputs=16` → `i0:in[1] i1:in[1] i2:in[1] i3:in[1] i4:in[1] i5:in[1] i6:in[1] i7:in[1] i8:in[1] i9:in[1] i10:in[1] i11:in[1] i12:in[1] i13:in[1] i14:in[1] i15:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1]`
- `inputs=32` → `i0:in[1] i1:in[1] i2:in[1] i3:in[1] i4:in[1] i5:in[1] i6:in[1] i7:in[1] i8:in[1] i9:in[1] i10:in[1] i11:in[1] i12:in[1] i13:in[1] i14:in[1] i15:in[1] i16:in[1] i17:in[1] i18:in[1] i19:in[1] i20:in[1] i21:in[1] i22:in[1] i23:in[1] i24:in[1] i25:in[1] i26:in[1] i27:in[1] i28:in[1] i29:in[1] i30:in[1] i31:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1]`
- `inputs=64` → `i0:in[1] i1:in[1] i2:in[1] i3:in[1] i4:in[1] i5:in[1] i6:in[1] i7:in[1] i8:in[1] i9:in[1] i10:in[1] i11:in[1] i12:in[1] i13:in[1] i14:in[1] i15:in[1] i16:in[1] i17:in[1] i18:in[1] i19:in[1] i20:in[1] i21:in[1] i22:in[1] i23:in[1] i24:in[1] i25:in[1] i26:in[1] i27:in[1] i28:in[1] i29:in[1] i30:in[1] i31:in[1] i32:in[1] i33:in[1] i34:in[1] i35:in[1] i36:in[1] i37:in[1] i38:in[1] i39:in[1] i40:in[1] i41:in[1] i42:in[1] i43:in[1] i44:in[1] i45:in[1] i46:in[1] i47:in[1] i48:in[1] i49:in[1] i50:in[1] i51:in[1] i52:in[1] i53:in[1] i54:in[1] i55:in[1] i56:in[1] i57:in[1] i58:in[1] i59:in[1] i60:in[1] i61:in[1] i62:in[1] i63:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1]`
- `inputMode=bus` → `i:in[4] y0:out[1] y1:out[1]`
- `outputMode=bus` → `i0:in[1] i1:in[1] i2:in[1] i3:in[1] y:out[2]`

## DEC

Defaults: `{"outputs":4,"inputMode":"pins","outputMode":"pins"}`

Pins: `a0:in[1] a1:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] en:in[1]`

| Parameter | Accepted values |
|---|---|
| outputs | 4, 8, 16, 32, 64 |
| inputMode | pins, bus |
| outputMode | pins, bus |

- `outputs=8` → `a0:in[1] a1:in[1] a2:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] en:in[1]`
- `outputs=16` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] y8:out[1] y9:out[1] y10:out[1] y11:out[1] y12:out[1] y13:out[1] y14:out[1] y15:out[1] en:in[1]`
- `outputs=32` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] a4:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] y8:out[1] y9:out[1] y10:out[1] y11:out[1] y12:out[1] y13:out[1] y14:out[1] y15:out[1] y16:out[1] y17:out[1] y18:out[1] y19:out[1] y20:out[1] y21:out[1] y22:out[1] y23:out[1] y24:out[1] y25:out[1] y26:out[1] y27:out[1] y28:out[1] y29:out[1] y30:out[1] y31:out[1] en:in[1]`
- `outputs=64` → `a0:in[1] a1:in[1] a2:in[1] a3:in[1] a4:in[1] a5:in[1] y0:out[1] y1:out[1] y2:out[1] y3:out[1] y4:out[1] y5:out[1] y6:out[1] y7:out[1] y8:out[1] y9:out[1] y10:out[1] y11:out[1] y12:out[1] y13:out[1] y14:out[1] y15:out[1] y16:out[1] y17:out[1] y18:out[1] y19:out[1] y20:out[1] y21:out[1] y22:out[1] y23:out[1] y24:out[1] y25:out[1] y26:out[1] y27:out[1] y28:out[1] y29:out[1] y30:out[1] y31:out[1] y32:out[1] y33:out[1] y34:out[1] y35:out[1] y36:out[1] y37:out[1] y38:out[1] y39:out[1] y40:out[1] y41:out[1] y42:out[1] y43:out[1] y44:out[1] y45:out[1] y46:out[1] y47:out[1] y48:out[1] y49:out[1] y50:out[1] y51:out[1] y52:out[1] y53:out[1] y54:out[1] y55:out[1] y56:out[1] y57:out[1] y58:out[1] y59:out[1] y60:out[1] y61:out[1] y62:out[1] y63:out[1] en:in[1]`
- `inputMode=bus` → `a:in[2] y0:out[1] y1:out[1] y2:out[1] y3:out[1] en:in[1]`
- `outputMode=bus` → `a0:in[1] a1:in[1] y:out[4] en:in[1]`

## DFF

Defaults: `{"edge":"rising","reset":false,"preset":false,"enable":false}`

Pins: `d:in[1] clk:in[1] q:out[1] qn:out[1]`

| Parameter | Accepted values |
|---|---|
| edge | rising, falling |
| reset | true, false |
| preset | true, false |
| enable | true, false |

- `reset=true` → `d:in[1] clk:in[1] rst:in[1] q:out[1] qn:out[1]`
- `preset=true` → `d:in[1] clk:in[1] pre:in[1] q:out[1] qn:out[1]`
- `enable=true` → `d:in[1] clk:in[1] en:in[1] q:out[1] qn:out[1]`

## JKFF

Defaults: `{"edge":"rising","reset":false,"preset":false,"enable":false}`

Pins: `j:in[1] k:in[1] clk:in[1] q:out[1] qn:out[1]`

| Parameter | Accepted values |
|---|---|
| edge | rising, falling |
| reset | true, false |
| preset | true, false |
| enable | true, false |

- `reset=true` → `j:in[1] k:in[1] clk:in[1] rst:in[1] q:out[1] qn:out[1]`
- `preset=true` → `j:in[1] k:in[1] clk:in[1] pre:in[1] q:out[1] qn:out[1]`
- `enable=true` → `j:in[1] k:in[1] clk:in[1] en:in[1] q:out[1] qn:out[1]`

## TFF

Defaults: `{"edge":"rising","reset":false,"preset":false,"enable":false}`

Pins: `t:in[1] clk:in[1] q:out[1] qn:out[1]`

| Parameter | Accepted values |
|---|---|
| edge | rising, falling |
| reset | true, false |
| preset | true, false |
| enable | true, false |

- `reset=true` → `t:in[1] clk:in[1] rst:in[1] q:out[1] qn:out[1]`
- `preset=true` → `t:in[1] clk:in[1] pre:in[1] q:out[1] qn:out[1]`
- `enable=true` → `t:in[1] clk:in[1] en:in[1] q:out[1] qn:out[1]`

## SRFF

Defaults: `{"edge":"rising","reset":false,"preset":false,"enable":false}`

Pins: `s:in[1] r:in[1] clk:in[1] q:out[1] qn:out[1]`

| Parameter | Accepted values |
|---|---|
| edge | rising, falling |
| reset | true, false |
| preset | true, false |
| enable | true, false |

- `reset=true` → `s:in[1] r:in[1] clk:in[1] rst:in[1] q:out[1] qn:out[1]`
- `preset=true` → `s:in[1] r:in[1] clk:in[1] pre:in[1] q:out[1] qn:out[1]`
- `enable=true` → `s:in[1] r:in[1] clk:in[1] en:in[1] q:out[1] qn:out[1]`
