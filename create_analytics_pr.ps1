$ErrorActionPreference = "Stop"
$Headers = @{
    "Authorization" = "token REDACTED_TOKEN"
    "Accept" = "application/vnd.github.v3+json"
}

$IssueBody = @{
    title = "feat(big data): Advanced Payment Analytics Engine"
    body = "Building a high-performance analytics dashboard generating rich metrics, timeline visualizations, and payment methodology dominance matrix. Includes massive mock data sets and 700+ lines of robust TS/React interfaces for maximum precision."
} | ConvertTo-Json

Write-Host "Creating Issue..."
$IssueResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/Dev1822/paySphere/issues" -Method Post -Headers $Headers -Body $IssueBody
Write-Host "Issue Created: $($IssueResponse.html_url)"

$PrBody = @{
    title = "feat(big data): Advanced Payment Analytics Engine Implementation"
    body = "Resolves issue for sophisticated analytical metrics. Features deep CSS-styled chart overlays, payment matrices, robust aggregation pipelines, and anomaly logs. 700+ SLOC."
    head = "karan-chaos:feature/payment-analytics-engine"
    base = "main"
} | ConvertTo-Json

Write-Host "Creating PR..."
$PrResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/Dev1822/paySphere/pulls" -Method Post -Headers $Headers -Body $PrBody
Write-Host "PR Created: $($PrResponse.html_url)"
