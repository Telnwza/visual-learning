library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_compare is
  generic (WIDTH:positive range 1 to 64:=8; SIGNED_MODE:natural range 0 to 1:=0);
  port (a,b:in std_logic_vector(WIDTH-1 downto 0); eq,lt,gt,le,ge:out std_logic);
end entity;
architecture rtl of ss_compare is begin
  process(a,b)
    variable less,equal:boolean;
  begin
    equal:=a=b;
    if SIGNED_MODE=1 then less:=signed(a)<signed(b); else less:=unsigned(a)<unsigned(b); end if;
    eq<='0'; lt<='0'; gt<='0'; le<='0'; ge<='0';
    if equal then eq<='1'; end if;
    if less then lt<='1'; else ge<='1'; end if;
    if less or equal then le<='1'; else gt<='1'; end if;
  end process;
end architecture;
