!macro customInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Admission CRM Port 3000"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Admission CRM Port 3000" protocol=TCP dir=in localport=3000 action=allow profile=any'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Admission CRM Port 3000"'
!macroend
