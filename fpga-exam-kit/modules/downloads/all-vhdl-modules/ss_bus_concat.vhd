library ieee;
use ieee.std_logic_1164.all;
entity ss_bus_concat is
  generic (A_WIDTH:positive range 1 to 63:=8; B_WIDTH:positive range 1 to 64-A_WIDTH:=8);
  port (a:in std_logic_vector(A_WIDTH-1 downto 0);
    b:in std_logic_vector(B_WIDTH-1 downto 0);
    y:out std_logic_vector(A_WIDTH+B_WIDTH-1 downto 0));
end entity;
architecture rtl of ss_bus_concat is begin
  y <= a & b;
end architecture;
