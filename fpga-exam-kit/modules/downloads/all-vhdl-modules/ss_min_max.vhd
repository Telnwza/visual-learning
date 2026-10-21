library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_min_max is
  generic (WIDTH:positive range 1 to 64:=8; SIGNED_MODE:natural range 0 to 1:=0);
  port (a,b:in std_logic_vector(WIDTH-1 downto 0); minimum,maximum:out std_logic_vector(WIDTH-1 downto 0));
end entity;
architecture rtl of ss_min_max is begin
  process(a,b)
    variable less:boolean;
  begin
    if SIGNED_MODE=1 then less:=signed(a)<signed(b); else less:=unsigned(a)<unsigned(b); end if;
    minimum<=b; maximum<=a; if less then minimum<=a; maximum<=b; end if;
  end process;
end architecture;
