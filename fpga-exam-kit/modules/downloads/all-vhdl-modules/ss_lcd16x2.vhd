library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_lcd16x2 is
  generic (POWERUP_CYCLES:positive range 1 to 2147483647:=2500000;
    INIT_WAIT_CYCLES:positive range 1 to 2147483647:=250000;
    CLEAR_WAIT_CYCLES:positive range 1 to 2147483647:=100000;
    STEP_CYCLES:positive range 1 to 2147483647:=50000;
    AUTO_REFRESH:natural range 0 to 1:=1);
  port (clk,rst,en,update:in std_logic; text_0,text_1,text_2,text_3:in std_logic_vector(63 downto 0);
    data:out std_logic_vector(7 downto 0); e,rs,rw,ready,busy,done:out std_logic);
end entity;
architecture rtl of ss_lcd16x2 is
  type states is (powerup,issue_byte,wait_byte,delay_byte,idle);
  signal state:states:=powerup;
  signal count:natural range 0 to 2147483646:=0;
  signal command:natural range 0 to 6:=0;
  signal cell:natural range 0 to 33:=0;
  signal initialized:std_logic:='0';
  signal frame:std_logic_vector(255 downto 0):=(others=>'0');
  signal byte_start,byte_done,byte_rs:std_logic:='0';
  signal byte_value:std_logic_vector(7 downto 0);
begin
  ready<=initialized; busy<='0' when state=idle else '1';
  writer:entity work.ss_lcd_write generic map(SETUP_CYCLES=>STEP_CYCLES,HIGH_CYCLES=>STEP_CYCLES,HOLD_CYCLES=>STEP_CYCLES)
    port map(clk=>clk,rst=>rst,start=>byte_start,byte_in=>byte_value,rs_in=>byte_rs,data=>data,e=>e,rs=>rs,rw=>rw,busy=>open,done=>byte_done);
  process(initialized,command,cell,frame)
  begin
    byte_rs<='0'; byte_value<=x"00";
    if initialized='0' then
      case command is
        when 0|1|2 => byte_value<=x"30";
        when 3 => byte_value<=x"38";
        when 4 => byte_value<=x"0C";
        when 5 => byte_value<=x"06";
        when others => byte_value<=x"01";
      end case;
    elsif cell=0 then byte_value<=x"80";
    elsif cell=17 then byte_value<=x"C0";
    else
      byte_rs<='1';
      if cell<17 then byte_value<=frame(8*(cell-1)+7 downto 8*(cell-1));
      else byte_value<=frame(8*(cell-2)+7 downto 8*(cell-2)); end if;
    end if;
  end process;
  process(clk)
    variable delay_cycles:positive;
  begin
    if rising_edge(clk) then
      byte_start<='0'; done<='0';
      if rst='1' then state<=powerup; count<=0; command<=0; cell<=0; initialized<='0'; frame<=(others=>'0');
      else
        case state is
          when powerup => if count=POWERUP_CYCLES-1 then count<=0; state<=issue_byte; else count<=count+1; end if;
          when issue_byte => byte_start<='1'; state<=wait_byte;
          when wait_byte =>
            if byte_done='1' then
              if initialized='0' then count<=0; state<=delay_byte;
              elsif cell=33 then done<='1'; state<=idle;
              else cell<=cell+1; state<=issue_byte; end if;
            end if;
          when delay_byte =>
            delay_cycles:=INIT_WAIT_CYCLES; if command=6 then delay_cycles:=CLEAR_WAIT_CYCLES; end if;
            if count=delay_cycles-1 then
              count<=0;
              if command=6 then initialized<='1'; state<=idle; else command<=command+1; state<=issue_byte; end if;
            else count<=count+1; end if;
          when idle =>
            if en='1' and (AUTO_REFRESH=1 or update='1') then frame<=text_3 & text_2 & text_1 & text_0; cell<=0; state<=issue_byte; end if;
        end case;
      end if;
    end if;
  end process;
end architecture;
