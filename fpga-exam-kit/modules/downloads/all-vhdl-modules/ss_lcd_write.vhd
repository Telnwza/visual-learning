library ieee;
use ieee.std_logic_1164.all;
entity ss_lcd_write is
  generic (SETUP_CYCLES:positive range 1 to 2147483647:=50000;
    HIGH_CYCLES:positive range 1 to 2147483647:=50000;
    HOLD_CYCLES:positive range 1 to 2147483647:=50000);
  port (clk,rst,start:in std_logic; byte_in:in std_logic_vector(7 downto 0); rs_in:in std_logic;
    data:out std_logic_vector(7 downto 0); e,rs,rw,busy,done:out std_logic);
end entity;
architecture rtl of ss_lcd_write is
  type states is (idle,setup,high_phase,hold_phase);
  signal state:states:=idle;
  signal count:natural range 0 to 2147483646:=0;
  signal value:std_logic_vector(7 downto 0):=(others=>'0'); signal register_select:std_logic:='0';
begin
  data<=value; rs<=register_select; rw<='0';
  e<='1' when state=high_phase else '0'; busy<='0' when state=idle else '1';
  process(clk)
  begin
    if rising_edge(clk) then
      done<='0';
      if rst='1' then state<=idle; count<=0; value<=(others=>'0'); register_select<='0';
      else
        case state is
          when idle => if start='1' then value<=byte_in; register_select<=rs_in; count<=0; state<=setup; end if;
          when setup => if count=SETUP_CYCLES-1 then count<=0; state<=high_phase; else count<=count+1; end if;
          when high_phase => if count=HIGH_CYCLES-1 then count<=0; state<=hold_phase; else count<=count+1; end if;
          when hold_phase => if count=HOLD_CYCLES-1 then count<=0; state<=idle; done<='1'; else count<=count+1; end if;
        end case;
      end if;
    end if;
  end process;
end architecture;
