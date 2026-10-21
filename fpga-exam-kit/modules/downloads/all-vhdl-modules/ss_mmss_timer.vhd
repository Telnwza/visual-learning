library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_mmss_timer is
  generic (MAX_MINUTES:natural range 0 to 99:=99; TICKS_PER_SECOND:positive range 1 to 2147483647:=50000000);
  port (clk,rst,en,start,pause,load,down:in std_logic;
    load_minutes:in std_logic_vector(6 downto 0); load_seconds:in std_logic_vector(5 downto 0);
    minutes:out std_logic_vector(6 downto 0); seconds:out std_logic_vector(5 downto 0);
    digits:out std_logic_vector(15 downto 0); running,terminal,done,valid,load_error:out std_logic);
end entity;
architecture rtl of ss_mmss_timer is
  signal minute_value:std_logic_vector(6 downto 0);
  signal second_value:std_logic_vector(5 downto 0);
  signal minute_bcd,second_bcd:std_logic_vector(63 downto 0);
  signal active,event_done,event_error:std_logic:='0';
  signal at_end,load_ok,load_time,tick_reset,tick_enable,tick,step,minute_step,counter_down:std_logic;
  signal minute_valid,second_valid,minute_digits_valid,second_digits_valid:std_logic;
begin
  minutes<=minute_value; seconds<=second_value; digits<=minute_bcd(7 downto 0) & second_bcd(7 downto 0);
  running<=active; terminal<=at_end; done<=event_done; load_error<=event_error;
  valid<=minute_valid and second_valid and minute_digits_valid and second_digits_valid;
  load_ok<='1' when not is_x(load_minutes & load_seconds) and unsigned(load_minutes)<=MAX_MINUTES and unsigned(load_seconds)<=59 else '0';
  load_time<=load and load_ok;
  counter_down<=down and not rst;
  at_end<='1' when (down='1' and unsigned(minute_value)=0 and unsigned(second_value)=0) or
    (down='0' and unsigned(minute_value)=MAX_MINUTES and unsigned(second_value)=59) else '0';
  tick_reset<=rst or load or start or pause or not en;
  tick_enable<=active and en and not at_end;
  step<=tick and active and en and not at_end and not rst and not load and not pause and not start;
  minute_step<='1' when step='1' and ((down='0' and unsigned(second_value)=59) or (down='1' and unsigned(second_value)=0)) else '0';
  second_tick:entity work.ss_tick generic map(DIVISOR=>TICKS_PER_SECOND)
    port map(clk=>clk,rst=>tick_reset,en=>tick_enable,tick=>tick);
  minute_counter:entity work.ss_counter generic map(WIDTH=>7,WRAP=>0)
    port map(clk=>clk,rst=>rst,en=>minute_step,load=>load_time,down=>counter_down,minimum=>"0000000",
      maximum=>std_logic_vector(to_unsigned(MAX_MINUTES,7)),load_value=>load_minutes,q=>minute_value,valid=>minute_valid,terminal=>open,wrapped=>open);
  second_counter:entity work.ss_counter generic map(WIDTH=>6,WRAP=>1)
    port map(clk=>clk,rst=>rst,en=>step,load=>load_time,down=>counter_down,minimum=>"000000",maximum=>"111011",
      load_value=>load_seconds,q=>second_value,valid=>second_valid,terminal=>open,wrapped=>open);
  minute_format:entity work.ss_bin_to_bcd generic map(WIDTH=>7,DIGITS=>2)
    port map(d=>minute_value,bcd_lo=>minute_bcd,bcd_hi=>open,negative=>open,overflow=>open,valid=>minute_digits_valid);
  second_format:entity work.ss_bin_to_bcd generic map(WIDTH=>6,DIGITS=>2)
    port map(d=>second_value,bcd_lo=>second_bcd,bcd_hi=>open,negative=>open,overflow=>open,valid=>second_digits_valid);
  process(clk)
  begin
    if rising_edge(clk) then
      event_done<='0'; event_error<='0';
      if rst='1' then active<='0';
      elsif load='1' then active<='0'; if load_ok/='1' then event_error<='1'; end if;
      elsif pause='1' then active<='0';
      elsif start='1' then
        if at_end='1' then active<='0'; event_done<='1'; else active<='1'; end if;
      elsif active='1' then
        if at_end='1' or (step='1' and ((down='1' and unsigned(minute_value)=0 and unsigned(second_value)=1) or
          (down='0' and unsigned(minute_value)=MAX_MINUTES and unsigned(second_value)=58))) then active<='0'; event_done<='1'; end if;
      end if;
    end if;
  end process;
end architecture;
