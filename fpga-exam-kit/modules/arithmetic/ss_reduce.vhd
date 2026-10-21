library ieee;
use ieee.std_logic_1164.all;
entity ss_reduce is
  generic (WIDTH:positive range 1 to 64:=8);
  port (d:in std_logic_vector(WIDTH-1 downto 0); all_one,any_one,xor_reduce,even_parity,odd_parity:out std_logic);
end entity;
architecture rtl of ss_reduce is begin
  process(d)
    variable a,o,x:std_logic;
  begin
    a:='1'; o:='0'; x:='0';
    for i in 0 to WIDTH-1 loop a:=a and d(i); o:=o or d(i); x:=x xor d(i); end loop;
    all_one<=a; any_one<=o; xor_reduce<=x; even_parity<=x; odd_parity<=not x;
  end process;
end architecture;
