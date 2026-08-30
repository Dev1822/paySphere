$ErrorActionPreference = "Stop"
$Headers = @{
    "Authorization" = "token REDACTED_TOKEN"
    "Accept" = "application/vnd.github.v3+json"
}

$IssueBody = @{
    title = "feat: Security & Audit Log Dashboard"
    body = "Implementing a new premium UI for security logs with advanced filtering, timeline features, and stateful mock generation. Covers 500+ lines of new robust TypeScript/React implementation."
} | ConvertTo-Json

Write-Host "Creating Issue..."
$IssueResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/Dev1822/paySphere/issues" -Method Post -Headers $Headers -Body $IssueBody
Write-Host "Issue Created: $($IssueResponse.html_url)"

$PrBody = @{
    title = "feat: Security & Audit Log Dashboard Implementation"
    body = "Resolves issue for rich audit log rendering. Includes 5 new production-grade files for filtering, timeline, modals, and mock datasets. High contrast dashboard."
    head = "karan-chaos:feature/rich-audit-logs-dashboard"
    base = "main"
} | ConvertTo-Json

Write-Host "Creating PR..."
$PrResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/Dev1822/paySphere/pulls" -Method Post -Headers $Headers -Body $PrBody
Write-Host "PR Created: $($PrResponse.html_url)"
