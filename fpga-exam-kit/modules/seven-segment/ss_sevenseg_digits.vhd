library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_sevenseg_digits is
  generic (DIGITS:positive range 1 to 16:=4; HEX_MODE:natural range 0 to 1:=0);
  port (digits_in:in std_logic_vector(63 downto 0); blank,dot:in std_logic_vector(DIGITS-1 downto 0);
    patterns_lo,patterns_hi:out std_logic_vector(63 downto 0); valid:out std_logic_vector(DIGITS-1 downto 0));
end entity;
architecture rtl of ss_sevenseg_digits is
  type patterns is array(0 to 15) of std_logic_vector(6 downto 0);
  constant lut:patterns:=("0111111","0000110","1011011","1001111","1100110","1101101","1111101","0000111","1111111","1101111","1110111","1111100","0111001","1011110","1111001","1110001");
begin
  process(digits_in,blank,dot)
    variable packed:std_logic_vector(127 downto 0); variable nibble:std_logic_vector(3 downto 0);
    variable n:natural range 0 to 15;
  begin
    packed:=(others=>'0'); valid<=(others=>'0');
    for i in 0 to DIGITS-1 loop
      nibble:=digits_in(4*i+3 downto 4*i);
      if blank(i)='0' and not is_x(nibble) then
        n:=to_integer(unsigned(nibble));
        if HEX_MODE=1 or n<10 then
          packed(8*i+6 downto 8*i):=lut(n); packed(8*i+7):=dot(i); valid(i)<='1';
        end if;
      end if;
    end loop;
    patterns_lo<=packed(63 downto 0); patterns_hi<=packed(127 downto 64);
  end process;
end architecture;
