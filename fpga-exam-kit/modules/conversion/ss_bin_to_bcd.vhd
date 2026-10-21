library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_bin_to_bcd is
  generic (WIDTH:positive range 1 to 64:=8; DIGITS:positive range 1 to 20:=3; SIGNED_MODE:natural range 0 to 1:=0);
  port (d:in std_logic_vector(WIDTH-1 downto 0);
    bcd_lo:out std_logic_vector(63 downto 0); bcd_hi:out std_logic_vector(15 downto 0);
    negative,valid,overflow:out std_logic);
end entity;
architecture rtl of ss_bin_to_bcd is begin
  process(d)
    variable magnitude:unsigned(WIDTH-1 downto 0);
    variable digits_value:unsigned(79 downto 0);
    variable too_large:boolean;
  begin
    digits_value:=(others=>'0'); negative<='0'; valid<='0'; overflow<='0';
    if not is_x(d) then
      magnitude:=unsigned(d);
      if SIGNED_MODE=1 and d(WIDTH-1)='1' then magnitude:=unsigned(-signed(d)); negative<='1'; end if;
      for bit_index in WIDTH-1 downto 0 loop
        for digit in 0 to 19 loop
          if digits_value(4*digit+3 downto 4*digit)>=5 then
            digits_value(4*digit+3 downto 4*digit):=digits_value(4*digit+3 downto 4*digit)+3;
          end if;
        end loop;
        digits_value:=shift_left(digits_value,1); digits_value(0):=magnitude(bit_index);
      end loop;
      too_large:=false;
      for digit in DIGITS to 19 loop if digits_value(4*digit+3 downto 4*digit)/=0 then too_large:=true; end if; end loop;
      if too_large then overflow<='1'; else valid<='1'; end if;
    end if;
    bcd_lo<=std_logic_vector(digits_value(63 downto 0)); bcd_hi<=std_logic_vector(digits_value(79 downto 64));
  end process;
end architecture;
