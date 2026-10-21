library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_number_formatter is
  generic (DIGITS:positive range 1 to 20:=3; HEX_MODE:natural range 0 to 1:=0;
    SIGNED_DISPLAY:natural range 0 to 1:=0; LEADING_ZERO:natural range 0 to 1:=0;
    FRACTION_DIGITS:natural range 0 to DIGITS:=0; UPPERCASE:natural range 0 to 1:=1);
  port (digits_lo:in std_logic_vector(63 downto 0); digits_hi:in std_logic_vector(15 downto 0);
    negative,input_valid:in std_logic;
    text_0,text_1,text_2,text_3:out std_logic_vector(63 downto 0);
    length:out std_logic_vector(4 downto 0); valid,overflow:out std_logic);
end entity;
architecture rtl of ss_number_formatter is begin
  process(digits_lo,digits_hi,negative,input_valid)
    variable packed:std_logic_vector(79 downto 0);
    variable text_value:std_logic_vector(255 downto 0);
    variable position:natural range 0 to 32;
    variable value,ascii:natural range 0 to 255;
    variable bad,too_large,seen:boolean;
  begin
    packed:=digits_hi & digits_lo; text_value:=(others=>'0');
    for i in 0 to 31 loop text_value(8*i+7 downto 8*i):=x"20"; end loop;
    bad:=input_valid/='1' or is_x(packed) or (negative/='0' and negative/='1'); too_large:=false; seen:=false;
    position:=0; valid<='0'; overflow<='0';
    if not bad then
      for i in 0 to 19 loop
        value:=to_integer(unsigned(packed(4*i+3 downto 4*i)));
        if HEX_MODE=0 and value>9 then bad:=true; end if;
        if i>=DIGITS and value/=0 then too_large:=true; end if;
      end loop;
      if SIGNED_DISPLAY=0 and negative='1' then too_large:=true; end if;
    end if;
    if SIGNED_DISPLAY=1 then
      if negative='1' then text_value(7 downto 0):=x"2D"; end if;
      position:=1;
    end if;
    if FRACTION_DIGITS=DIGITS then text_value(8*position+7 downto 8*position):=x"30"; position:=position+1; end if;
    for i in DIGITS-1 downto 0 loop
      if FRACTION_DIGITS>0 and i=FRACTION_DIGITS-1 then
        text_value(8*position+7 downto 8*position):=x"2E"; position:=position+1;
      end if;
      ascii:=48;
      if not bad then
        value:=to_integer(unsigned(packed(4*i+3 downto 4*i)));
        if value<10 then ascii:=48+value;
        elsif UPPERCASE=1 then ascii:=65+value-10; else ascii:=97+value-10; end if;
        if LEADING_ZERO=0 and not seen and value=0 and i>FRACTION_DIGITS then ascii:=32;
        else seen:=true; end if;
      end if;
      text_value(8*position+7 downto 8*position):=std_logic_vector(to_unsigned(ascii,8)); position:=position+1;
    end loop;
    if bad or too_large then
      ascii:=63; if too_large then ascii:=35; overflow<='1'; end if;
      for i in 0 to 31 loop
        if i<position then text_value(8*i+7 downto 8*i):=std_logic_vector(to_unsigned(ascii,8)); end if;
      end loop;
    else valid<='1'; end if;
    length<=std_logic_vector(to_unsigned(position,5));
    text_0<=text_value(63 downto 0); text_1<=text_value(127 downto 64);
    text_2<=text_value(191 downto 128); text_3<=text_value(255 downto 192);
  end process;
end architecture;
