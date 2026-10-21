library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_digit_ascii is
  generic (HEX_MODE:natural range 0 to 1:=0; UPPERCASE:natural range 0 to 1:=1);
  port (digit:in std_logic_vector(3 downto 0); character:out std_logic_vector(7 downto 0); valid:out std_logic);
end entity;
architecture rtl of ss_digit_ascii is begin
  process(digit)
    variable value:natural range 0 to 15;
  begin
    character<=x"3F"; valid<='0';
    if not is_x(digit) then
      value:=to_integer(unsigned(digit));
      if value<10 then character<=std_logic_vector(to_unsigned(48+value,8)); valid<='1';
      elsif HEX_MODE=1 then
        if UPPERCASE=1 then character<=std_logic_vector(to_unsigned(65+value-10,8));
        else character<=std_logic_vector(to_unsigned(97+value-10,8)); end if;
        valid<='1';
      end if;
    end if;
  end process;
end architecture;
