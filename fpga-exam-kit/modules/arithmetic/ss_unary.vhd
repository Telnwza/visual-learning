library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_unary is
  generic (WIDTH:positive range 1 to 64:=8; OPERATION:natural range 0 to 1:=0; SIGNED_MODE:natural range 0 to 1:=1);
  port (d:in std_logic_vector(WIDTH-1 downto 0); y:out std_logic_vector(WIDTH-1 downto 0); overflow,zero,negative:out std_logic);
end entity;
architecture rtl of ss_unary is begin
  process(d)
    variable result,min_value:unsigned(WIDTH-1 downto 0);
    variable invert:boolean;
  begin
    min_value:=(others=>'0'); min_value(WIDTH-1):='1';
    invert:=OPERATION=0 or (SIGNED_MODE=1 and d(WIDTH-1)='1');
    result:=unsigned(d); if invert then result:=unsigned(-signed(d)); end if;
    y<=std_logic_vector(result); overflow<='0'; negative<='0';
    if SIGNED_MODE=1 then
      negative<=result(WIDTH-1);
      if invert and unsigned(d)=min_value then overflow<='1'; end if;
    elsif invert and unsigned(d)/=0 then overflow<='1'; end if;
    zero<='0'; if result=0 then zero<='1'; end if;
  end process;
end architecture;
