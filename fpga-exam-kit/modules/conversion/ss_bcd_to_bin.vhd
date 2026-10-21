library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_bcd_to_bin is
  generic (WIDTH:positive range 1 to 64:=8; DIGITS:positive range 1 to 20:=3; SIGNED_MODE:natural range 0 to 1:=0);
  port (bcd_lo:in std_logic_vector(63 downto 0); bcd_hi:in std_logic_vector(15 downto 0); negative:in std_logic;
    y:out std_logic_vector(WIDTH-1 downto 0); valid,overflow,invalid_digit:out std_logic);
end entity;
architecture rtl of ss_bcd_to_bin is begin
  process(bcd_lo,bcd_hi,negative)
    variable packed:std_logic_vector(79 downto 0);
    variable magnitude,limit_value:unsigned(66 downto 0);
    variable nibble:unsigned(3 downto 0);
    variable result:unsigned(WIDTH-1 downto 0);
    variable bad_digit,too_large:boolean;
  begin
    packed:=bcd_hi & bcd_lo; magnitude:=(others=>'0'); bad_digit:=false; too_large:=false;
    y<=(others=>'0'); valid<='0'; overflow<='0'; invalid_digit<='0';
    if is_x(packed) or (negative/='0' and negative/='1') then invalid_digit<='1';
    else
      for digit in 19 downto 0 loop
        nibble:=unsigned(packed(4*digit+3 downto 4*digit));
        if nibble>9 then bad_digit:=true;
        else magnitude:=shift_left(magnitude,3)+shift_left(magnitude,1)+resize(nibble,67); end if;
        if digit>=DIGITS and nibble/=0 then too_large:=true; end if;
      end loop;
      if SIGNED_MODE=1 then
        limit_value:=shift_left(to_unsigned(1,67),WIDTH-1);
        if negative='0' then limit_value:=limit_value-1; end if;
      else
        limit_value:=shift_left(to_unsigned(1,67),WIDTH)-1;
        if negative='1' and magnitude/=0 then too_large:=true; end if;
      end if;
      if magnitude>limit_value then too_large:=true; end if;
      if bad_digit then invalid_digit<='1';
      elsif too_large then overflow<='1';
      else
        result:=resize(magnitude,WIDTH);
        if SIGNED_MODE=1 and negative='1' then result:=unsigned(-signed(result)); end if;
        y<=std_logic_vector(result); valid<='1';
      end if;
    end if;
  end process;
end architecture;
