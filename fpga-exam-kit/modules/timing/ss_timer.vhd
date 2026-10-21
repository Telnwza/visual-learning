library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_timer is
  generic (WIDTH:positive range 1 to 64:=32; RETRIGGER:natural range 0 to 1:=1);
  port (clk,rst,en,start,cancel:in std_logic;
    duration:in std_logic_vector(WIDTH-1 downto 0);
    busy,done,pulse:out std_logic;
    remaining:out std_logic_vector(WIDTH-1 downto 0));
end entity;
architecture rtl of ss_timer is
  signal active,completion:std_logic:='0';
  signal left_cycles:unsigned(WIDTH-1 downto 0):=(others=>'0');
begin
  busy <= active; pulse <= active; done <= completion;
  remaining <= std_logic_vector(left_cycles);
  process(clk) begin
    if rising_edge(clk) then
      completion<='0';
      if rst='1' or cancel='1' then active<='0'; left_cycles<=(others=>'0');
      elsif start='1' and (active='0' or RETRIGGER=1) then
        left_cycles<=unsigned(duration);
        if unsigned(duration)=0 then active<='0'; completion<='1';
        else active<='1'; end if;
      elsif en='1' and active='1' then
        if left_cycles=1 then active<='0'; left_cycles<=(others=>'0'); completion<='1';
        else left_cycles<=left_cycles-1; end if;
      end if;
    end if;
  end process;
end architecture;
