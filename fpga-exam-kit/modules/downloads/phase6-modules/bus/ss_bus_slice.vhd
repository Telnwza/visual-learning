library ieee;
use ieee.std_logic_1164.all;
entity ss_bus_slice is
  generic (IN_WIDTH:positive range 1 to 64:=16;
    OUT_WIDTH:positive range 1 to IN_WIDTH:=8;
    LSB:natural range 0 to IN_WIDTH-OUT_WIDTH:=0);
  port (d:in std_logic_vector(IN_WIDTH-1 downto 0);
    y:out std_logic_vector(OUT_WIDTH-1 downto 0));
end entity;
architecture rtl of ss_bus_slice is begin
  y <= d(LSB+OUT_WIDTH-1 downto LSB);
end architecture;
