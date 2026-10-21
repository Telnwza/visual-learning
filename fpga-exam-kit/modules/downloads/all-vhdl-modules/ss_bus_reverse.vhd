library ieee;
use ieee.std_logic_1164.all;
entity ss_bus_reverse is
  generic (WIDTH:positive range 1 to 64:=8);
  port (d:in std_logic_vector(WIDTH-1 downto 0);
    y:out std_logic_vector(WIDTH-1 downto 0));
end entity;
architecture rtl of ss_bus_reverse is begin
  bits:for i in 0 to WIDTH-1 generate y(i)<=d(WIDTH-1-i); end generate;
end architecture;
