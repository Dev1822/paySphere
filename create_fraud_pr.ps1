$ErrorActionPreference = "Stop"
$Headers = @{
    "Authorization" = "token REDACTED_TOKEN"
    "Accept" = "application/vnd.github.v3+json"
}

$IssueBody = @{
    title = "feat(security): Enterprise Fraud & Risk Management Console"
    body = "Building a specialized AI risk management dashboard. Implementing a complex heatmap matrix, timeline-based alert view, IP/Asset blocklist form handling, and comprehensive mock algorithms. Spans well over 700+ SLOC."
} | ConvertTo-Json

Write-Host "Creating Issue..."
$IssueResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/Dev1822/paySphere/issues" -Method Post -Headers $Headers -Body $IssueBody
Write-Host "Issue Created: $($IssueResponse.html_url)"

$PrBody = @{
    title = "feat(security): Fraud & Risk Console Implementation"
    body = "Resolves issue for Fraud tools. Generates beautiful Tailwind CSS components, a mock service layer returning comprehensive data matrix nodes, and full alert interactions."
    head = "karan-chaos:feature/fraud-risk-console"
    base = "main"
} | ConvertTo-Json

Write-Host "Creating PR..."
$PrResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/Dev1822/paySphere/pulls" -Method Post -Headers $Headers -Body $PrBody
Write-Host "PR Created: $($PrResponse.html_url)"
