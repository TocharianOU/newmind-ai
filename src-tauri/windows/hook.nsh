!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
    RMDir /r "$PROFILE\.newmind"
  ${EndIf}
!macroend