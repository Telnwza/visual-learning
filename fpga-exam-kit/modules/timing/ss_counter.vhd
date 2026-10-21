library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_counter is
  generic (WIDTH:positive range 1 to 64:=8; WRAP:natural range 0 to 1:=1);
  port (clk,rst,en,load,down:in std_logic;
    minimum,maximum,load_value:in std_logic_vector(WIDTH-1 downto 0);
    q:out std_logic_vector(WIDTH-1 downto 0);
    valid,terminal,wrapped:out std_logic);
end entity;
architecture rtl of ss_counter is
  signal value:unsigned(WIDTH-1 downto 0):=(others=>'0');
  signal wrap_event:std_logic:='0';
begin
  q <= std_logic_vector(value);
  valid <= '1' when unsigned(minimum)<=unsigned(maximum) and value>=unsigned(minimum) and value<=unsigned(maximum) else '0';
  terminal <= '1' when unsigned(minimum)<=unsigned(maximum) and
    ((down='0' and value=unsigned(maximum)) or (down='1' and value=unsigned(minimum))) else '0';
  wrapped <= wrap_event;
  process(clk)
    variable lo,hi,first:unsigned(WIDTH-1 downto 0);
  begin
    if rising_edge(clk) then
      lo:=unsigned(minimum); hi:=unsigned(maximum);
      first:=lo; if down='1' then first:=hi; end if;
      wrap_event<='0';
      if rst='1' then value<=first;
      elsif lo<=hi then
        if load='1' then
          if unsigned(load_value)<lo then value<=lo;
          elsif unsigned(load_value)>hi then value<=hi;
          else value<=unsigned(load_value); end if;
        elsif en='1' then
          if value<lo or value>hi then value<=first;
          elsif (down='0' and value=hi) or (down='1' and value=lo) then
            if WRAP=1 then value<=first; wrap_event<='1'; end if;
          elsif down='1' then value<=value-1;
          else value<=value+1; end if;
        end if;
      end if;
    end if;
  end process;
end architecture;
