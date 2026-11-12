param([switch]$Check)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  throw 'Codex CLI was not found. Install/sign in to Codex, then run npm run ai again.'
}
$taskPrompt = 'Read AGENTS.md, docs/STATUS.md, docs/PLAN.md, docs/ARCHITECTURE.md and docs/RELATE_RESOURCES.md. Before Relate work, read node_modules/@relate/relate/.agents/skills/relate/SKILL.md and the relevant installed index.d.ts types. Summarize the verified current state in Korean and continue the next authorized task end to end. Use real Relate, run the relevant acceptance checks, and update the handoff. Do not open the live database from another process. Do not start an unapproved milestone or paid model API integration.'
Push-Location $taskRoot
try {
  & node --import tsx (Join-Path $PSScriptRoot 'relate-context.ts')
  if ($LASTEXITCODE -ne 0) { throw 'Relate development context check failed. Run npm ci and resolve the reported error.' }
} finally {
  Pop-Location
}
if ($Check) {
  Write-Output 'Astra launcher: gpt-6-astra; reasoning: high'
  Write-Output 'Workspace: current Ripple repository'
  & codex --version
  & codex login status
  exit $LASTEXITCODE
}
# Explicit flags take precedence even if project config is not trusted yet.
# Do not change the user's global auth, sandbox or approval policy.
& codex --cd $taskRoot --model gpt-6-astra -c 'model_reasoning_effort="high"' $taskPrompt
exit $LASTEXITCODE
