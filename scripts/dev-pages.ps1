$ErrorActionPreference = 'Stop'

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx --yes wrangler@4 pages dev dist --compatibility-date=2026-06-21
exit $LASTEXITCODE
