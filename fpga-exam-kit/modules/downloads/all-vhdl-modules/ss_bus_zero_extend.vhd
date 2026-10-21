library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_bus_zero_extend is
  generic (IN_WIDTH:positive range 1 to 64:=8; OUT_WIDTH:positive range IN_WIDTH to 64:=16);
  port (d:in std_logic_vector(IN_WIDTH-1 downto 0);
    y:out std_logic_vector(OUT_WIDTH-1 downto 0));
end entity;
architecture rtl of ss_bus_zero_extend is begin
  y <= std_logic_vector(resize(unsigned(d),OUT_WIDTH));
end architecture;
