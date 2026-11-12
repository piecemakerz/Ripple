param([switch]$Check)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  throw 'Codex CLI was not found. Install/sign in to Codex, then run npm run ai again.'
}
$taskPrompt = 'Read AGENTS.md, docs/STATUS.md, docs/PLAN.md and docs/ARCHITECTURE.md. Summarize the verified current state in Korean and continue the next authorized task end to end. Use real Relate, run the relevant acceptance checks, and update the handoff. Do not start an unapproved milestone or paid model API integration.'
if ($Check) {
  Write-Output 'Astra launcher: gpt-6-astra; reasoning: high'
  Write-Output ('Workspace: ' + $taskRoot)
  & codex --version
  & codex login status
  exit $LASTEXITCODE
}
# Explicit flags take precedence even if project config is not trusted yet.
# Do not change the user's global auth, sandbox or approval policy.
& codex --cd $taskRoot --model gpt-6-astra -c 'model_reasoning_effort="high"' $taskPrompt
exit $LASTEXITCODE
