library ieee;
use ieee.std_logic_1164.all;
entity ss_bus_truncate is
  generic (IN_WIDTH:positive range 1 to 64:=16; OUT_WIDTH:positive range 1 to IN_WIDTH:=8);
  port (d:in std_logic_vector(IN_WIDTH-1 downto 0);
    y:out std_logic_vector(OUT_WIDTH-1 downto 0); lost:out std_logic);
end entity;
architecture rtl of ss_bus_truncate is begin
  y <= d(OUT_WIDTH-1 downto 0);
  process(d)
    variable discarded:std_logic;
  begin
    discarded:='0';
    for i in OUT_WIDTH to IN_WIDTH-1 loop discarded:=discarded or d(i); end loop;
    lost<=discarded;
  end process;
end architecture;
