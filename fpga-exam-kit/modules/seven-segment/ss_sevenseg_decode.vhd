library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_sevenseg_decode is
  generic (MODE:natural range 0 to 2:=0; ACTIVE_LOW:natural range 0 to 1:=0);
  port (digit:in std_logic_vector(3 downto 0); raw:in std_logic_vector(6 downto 0);
    blank,dot:in std_logic; segment:out std_logic_vector(6 downto 0); dp,valid:out std_logic);
end entity;
architecture rtl of ss_sevenseg_decode is
  type patterns is array(0 to 15) of std_logic_vector(6 downto 0);
  constant lut:patterns:=("0111111","0000110","1011011","1001111","1100110","1101101","1111101","0000111","1111111","1101111","1110111","1111100","0111001","1011110","1111001","1110001");
begin
  process(digit,raw,blank,dot)
    variable s:std_logic_vector(6 downto 0); variable p:std_logic; variable n:natural range 0 to 15;
  begin
    s:=(others=>'0'); p:='0'; valid<='0';
    if blank='0' then
      if MODE=2 then s:=raw; p:=dot; if not is_x(raw) and (dot='0' or dot='1') then valid<='1'; end if;
      elsif not is_x(digit) then
        n:=to_integer(unsigned(digit));
        if MODE=1 or n<10 then s:=lut(n); p:=dot; valid<='1'; end if;
      end if;
    end if;
    if ACTIVE_LOW=1 then segment<=not s; dp<=not p; else segment<=s; dp<=p; end if;
  end process;
end architecture;
