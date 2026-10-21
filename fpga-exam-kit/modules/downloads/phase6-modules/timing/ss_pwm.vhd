library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_pwm is
  generic (WIDTH:positive range 1 to 64:=16; ACTIVE_LOW:natural range 0 to 1:=0);
  port (clk,rst,en,load:in std_logic;
    period,duty:in std_logic_vector(WIDTH-1 downto 0);
    pwm,valid:out std_logic);
end entity;
architecture rtl of ss_pwm is
  signal phase,period_reg,duty_reg:unsigned(WIDTH-1 downto 0):=(others=>'0');
  signal active:std_logic;
begin
  valid <= '1' when period_reg/=0 else '0';
  active <= '1' when rst='0' and en='1' and period_reg/=0 and phase<duty_reg else '0';
  pwm <= active when ACTIVE_LOW=0 else not active;
  process(clk) begin
    if rising_edge(clk) then
      if rst='1' then phase<=(others=>'0'); period_reg<=(others=>'0'); duty_reg<=(others=>'0');
      elsif load='1' or (en='1' and (period_reg=0 or phase=period_reg-1)) then
        phase<=(others=>'0'); period_reg<=unsigned(period);
        if unsigned(duty)>unsigned(period) then duty_reg<=unsigned(period);
        else duty_reg<=unsigned(duty); end if;
      elsif en='1' then phase<=phase+1;
      end if;
    end if;
  end process;
end architecture;
