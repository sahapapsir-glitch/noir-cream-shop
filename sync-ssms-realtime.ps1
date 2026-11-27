param(
    [string]$ServerInstance = ".\SQLEXPRESS01",
    [string]$DatabaseName = "NoirCreamShop",
    [string]$WebUrl = "http://localhost:3000",
    [int]$IntervalSeconds = 5,
    [switch]$Once,
    [switch]$GitHubOnly
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$cwd = (Get-Location).Path
$baseDir = if ($PSScriptRoot) {
    $PSScriptRoot
} elseif (Test-Path (Join-Path $cwd "package.json")) {
    $cwd
} else {
    $tmpSyncDir = Join-Path $env:TEMP "noir-cream-shop-sync"
    if (-not (Test-Path $tmpSyncDir)) { New-Item -ItemType Directory -Path $tmpSyncDir -Force | Out-Null }
    $tmpSyncDir
}
$localSqlFile = Join-Path $baseDir "NoirCreamShop_SQLServer.sql"
$localSnapshotFile = Join-Path $baseDir "db-snapshot.json"
$localTokenFile = if (Test-Path (Join-Path $baseDir ".github-token")) { Join-Path $baseDir ".github-token" } else { Join-Path $cwd ".github-token" }
$githubRepo = "sahapapsir-glitch/noir-cream-shop"
$githubBranch = "main"
$githubRawSqlUrl = "https://raw.githubusercontent.com/$githubRepo/$githubBranch/NoirCreamShop_SQLServer.sql"
$script:warnedNoGit = $false

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  NOIR & CREAM — REALTIME SQL SERVER (SSMS) & GITHUB AUTO-SYNC" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. ค้นหาและเชื่อมต่อ SQL Server Instance บนเครื่อง (ค่าเริ่มต้น .\SQLEXPRESS01 ตาม SSMS)
$candidates = @($ServerInstance, ".\SQLEXPRESS01", "localhost\SQLEXPRESS01", ".\SQLEXPRESS", "localhost", "(localdb)\MSSQLLocalDB") | Select-Object -Unique
$activeInstance = $null

function Find-SqlInstance {
    if ($GitHubOnly) { return $null }
    foreach ($inst in $candidates) {
        try {
            $testConn = New-Object System.Data.SqlClient.SqlConnection("Server=$inst;Database=master;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=3")
            $testConn.Open()
            $testConn.Close()
            return $inst
        } catch {
            continue
        }
    }
    return $null
}

$activeInstance = Find-SqlInstance
if ($activeInstance) {
    Write-Host "✅ เชื่อมต่อ SQL Server สำเร็จ: $activeInstance (Database: [$DatabaseName])" -ForegroundColor Green
} else {
    Write-Host "⚠️ ยังไม่พบ SQL Server Instance (.\SQLEXPRESS01) — จะทำงานในโหมด Web -> GitHub Auto-Sync อัตโนมัติ" -ForegroundColor Yellow
    Write-Host "   (หากเปิด SQL Server ทีหลัง ระบบจะเชื่อมต่อให้อัตโนมัติ)" -ForegroundColor DarkGray
}

function Invoke-SqlScriptBatches {
    param([string]$ScriptText)
    if (-not $activeInstance) { return }
    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=$activeInstance;Database=master;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=10")
    $conn.Open()
    try {
        $batches = $ScriptText -split '(?m)^\s*GO\s*$'
        foreach ($batch in $batches) {
            $trimmed = $batch.Trim()
            if ($trimmed.Length -gt 0) {
                $cmd = $conn.CreateCommand()
                $cmd.CommandTimeout = 60
                $cmd.CommandText = $trimmed
                [void]$cmd.ExecuteNonQuery()
            }
        }
    } finally {
        $conn.Close()
    }
}

$tableNames = @(
    "admin", "employee", "coupon", "supplier", "customer", "address",
    "product", "product_variant", "cart_item", "order", "order_item",
    "payment", "shipment", "review", "wishlist", "review_like"
)

function Get-SsmsTablesState {
    if (-not $activeInstance) { return $null }
    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=$activeInstance;Database=$DatabaseName;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=5")
    $conn.Open()
    $state = [ordered]@{}
    try {
        foreach ($t in $tableNames) {
            $sqlName = if ($t -eq "order") { "dbo.[order]" } else { "dbo.$t" }
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = "SELECT * FROM $sqlName"
            $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
            $dt = New-Object System.Data.DataTable
            [void]$adapter.Fill($dt)
            $rows = @()
            foreach ($row in $dt.Rows) {
                $obj = [ordered]@{}
                foreach ($col in $dt.Columns) {
                    $val = $row[$col.ColumnName]
                    if ($val -is [System.DBNull]) {
                        $obj[$col.ColumnName] = $null
                    } elseif ($val -is [System.DateTime]) {
                        $obj[$col.ColumnName] = $val.ToString("yyyy-MM-dd HH:mm:ss")
                    } elseif ($val -is [bool]) {
                        $obj[$col.ColumnName] = if ($val) { 1 } else { 0 }
                    } else {
                        $obj[$col.ColumnName] = $val
                    }
                }
                $rows += [pscustomobject]$obj
            }
            $state[$t] = $rows
        }
    } finally {
        $conn.Close()
    }
    $json = ($state | ConvertTo-Json -Depth 6 -Compress)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $hashBytes = $sha.ComputeHash($bytes)
    $hash = ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").Substring(0, 16).ToLower()
    return @{
        Checksum = $hash
        Tables   = $state
    }
}

function Get-LocalSnapshotChecksum {
    if (-not (Test-Path $localSnapshotFile)) { return "" }
    try {
        $raw = [System.IO.File]::ReadAllText($localSnapshotFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        return [string]$raw.checksum
    } catch {
        return ""
    }
}

function Get-LocalSnapshotTimeMs {
    if (-not (Test-Path $localSnapshotFile)) { return 0 }
    try {
        $raw = [System.IO.File]::ReadAllText($localSnapshotFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        if ($raw.timestamp) {
            return [DateTimeOffset]::Parse([string]$raw.timestamp).ToUnixTimeMilliseconds()
        }
    } catch {}
    return 0
}

function Save-WebSnapshotFiles {
    param([object]$WebSnap, [string]$ScriptText)
    if (-not (Test-Path $baseDir)) { return }
    if ($ScriptText) {
        [System.IO.File]::WriteAllText($localSqlFile, $ScriptText, [System.Text.Encoding]::UTF8)
    }
    if ($WebSnap) {
        $snapJson = ($WebSnap | Select-Object instance, database, timestamp, checksum, counts, tables, views | ConvertTo-Json -Depth 8 -Compress)
        [System.IO.File]::WriteAllText($localSnapshotFile, $snapJson, [System.Text.Encoding]::UTF8)
    }
}

function Get-GitHubTokenLocal {
    if ($env:GITHUB_TOKEN -and $env:GITHUB_TOKEN.Trim()) { return $env:GITHUB_TOKEN.Trim() }
    if (Test-Path $localTokenFile) {
        try { return ([System.IO.File]::ReadAllText($localTokenFile, [System.Text.Encoding]::UTF8)).Trim() } catch {}
    }
    return ""
}

function Push-DatabaseToGitHubApi {
    param([string]$Reason, [string]$Token)
    $apiBase = "https://api.github.com/repos/$githubRepo"
    $headers = @{
        "Authorization"        = "Bearer $Token"
        "Accept"               = "application/vnd.github+json"
        "User-Agent"           = "NoirCreamShop-PSSync/1.0"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
    $refData = Invoke-RestMethod -Uri "$apiBase/git/ref/heads/$githubBranch" -Headers $headers -Method Get -TimeoutSec 15
    $latestCommitSha = $refData.object.sha
    $commitData = Invoke-RestMethod -Uri "$apiBase/git/commits/$latestCommitSha" -Headers $headers -Method Get -TimeoutSec 15
    $baseTreeSha = $commitData.tree.sha

    $treeItems = @()
    foreach ($relPath in @("db-snapshot.json", "NoirCreamShop_SQLServer.sql")) {
        $fullPath = Join-Path $baseDir $relPath
        if (Test-Path $fullPath) {
            $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($fullPath))
            $blobBody = (@{ content = $b64; encoding = "base64" } | ConvertTo-Json -Compress)
            $blob = Invoke-RestMethod -Uri "$apiBase/git/blobs" -Headers $headers -Method Post -Body $blobBody -ContentType "application/json; charset=utf-8" -TimeoutSec 20
            $treeItems += @{ path = $relPath; mode = "100644"; type = "blob"; sha = $blob.sha }
        }
    }
    $dbPath = Join-Path $baseDir "shop.db"
    if (Test-Path $dbPath) {
        $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($dbPath))
        $blobBody = (@{ content = $b64; encoding = "base64" } | ConvertTo-Json -Compress)
        $blob = Invoke-RestMethod -Uri "$apiBase/git/blobs" -Headers $headers -Method Post -Body $blobBody -ContentType "application/json; charset=utf-8" -TimeoutSec 25
        $treeItems += @{ path = "shop.db"; mode = "100644"; type = "blob"; sha = $blob.sha }
    }

    $treeBody = (@{ base_tree = $baseTreeSha; tree = $treeItems } | ConvertTo-Json -Depth 5 -Compress)
    $newTree = Invoke-RestMethod -Uri "$apiBase/git/trees" -Headers $headers -Method Post -Body $treeBody -ContentType "application/json; charset=utf-8" -TimeoutSec 20
    if ($newTree.sha -eq $baseTreeSha) {
        return $latestCommitSha.Substring(0, 7)
    }

    $cleanReason = ($Reason -replace '[\r\n]+', ' ')
    $commitBody = (@{
        message = "Auto-sync database ($cleanReason) [skip render]"
        tree    = $newTree.sha
        parents = @($latestCommitSha)
    } | ConvertTo-Json -Compress)
    $newCommit = Invoke-RestMethod -Uri "$apiBase/git/commits" -Headers $headers -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($commitBody)) -ContentType "application/json; charset=utf-8" -TimeoutSec 15
    $refBody = (@{ sha = $newCommit.sha; force = $false } | ConvertTo-Json -Compress)
    [void](Invoke-RestMethod -Uri "$apiBase/git/refs/heads/$githubBranch" -Headers $headers -Method Patch -Body $refBody -ContentType "application/json; charset=utf-8" -TimeoutSec 15)
    return $newCommit.sha.Substring(0, 7)
}

function Push-DatabaseToGitHub {
    param([string]$Reason = "Realtime Sync")
    $gitDir = Join-Path $baseDir ".git"
    if (Test-Path $gitDir) {
        try {
            Push-Location $baseDir
            $filesToAdd = @("NoirCreamShop_SQLServer.sql", "db-snapshot.json")
            if (Test-Path (Join-Path $baseDir "shop.db")) { $filesToAdd += "shop.db" }
            & git add @filesToAdd 2>$null
            $porcelain = (& git status --porcelain @filesToAdd 2>$null)
            if (-not $porcelain) { return }
            $cleanReason = ($Reason -replace '["`$\\\r\n]+', ' ')
            $commitOut = (& git -c user.name="Noir & Cream Bot" -c user.email="bot@noircreamshop.local" commit -m "Auto-sync database ($cleanReason) [skip render]" 2>&1 | Out-String)
            if ($LASTEXITCODE -ne 0) {
                Write-Host "   ⚠️ [GitHub Sync] Commit ไม่สำเร็จ: $($commitOut.Trim())" -ForegroundColor Yellow
                return
            }
            $pushOut = (& git push origin $githubBranch 2>&1 | Out-String)
            if ($LASTEXITCODE -ne 0) {
                if ($pushOut -match 'fetch first|non-fast-forward|rejected') {
                    & git fetch origin $githubBranch 2>&1 | Out-Null
                    & git merge -X ours --no-edit "origin/$githubBranch" 2>&1 | Out-Null
                    if ($LASTEXITCODE -ne 0) {
                        & git merge --abort 2>&1 | Out-Null
                    } else {
                        & git add @filesToAdd 2>$null
                        $postDiff = (& git status --porcelain @filesToAdd 2>$null)
                        if ($postDiff) {
                            & git -c user.name="Noir & Cream Bot" -c user.email="bot@noircreamshop.local" commit -m "Sync live snapshot ($cleanReason) [skip render]" 2>&1 | Out-Null
                        }
                        $pushOut = (& git push origin $githubBranch 2>&1 | Out-String)
                    }
                }
            }
            if ($LASTEXITCODE -eq 0) {
                $sha = (& git rev-parse --short HEAD 2>$null)
                Write-Host "   ☁️ [GitHub Sync] อัปเดตข้อมูลขึ้น GitHub สำเร็จ! (Commit: $sha)" -ForegroundColor Cyan
                return
            } else {
                Write-Host "   ⚠️ [GitHub Sync] Push ไม่สำเร็จ: $($pushOut.Trim())" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   ⚠️ [GitHub Sync] เกิดข้อผิดพลาด: $($_.Exception.Message)" -ForegroundColor Yellow
        } finally {
            Pop-Location
        }
    }

    $tok = Get-GitHubTokenLocal
    if ($tok) {
        try {
            $sha = Push-DatabaseToGitHubApi -Reason $Reason -Token $tok
            Write-Host "   ☁️ [GitHub Sync via API] อัปเดตข้อมูลขึ้น GitHub สำเร็จ! (Commit: $sha)" -ForegroundColor Cyan
        } catch {
            Write-Host "   ⚠️ [GitHub Sync API] Push ไม่สำเร็จ: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } elseif (-not (Test-Path $gitDir)) {
        if ($activeWebUrl -match '^https://') {
            return
        }
        if (-not $script:warnedNoGit) {
            $script:warnedNoGit = $true
            Write-Host "   ℹ️ ไม่พบ .git ในโฟลเดอร์นี้ — แนะนำ clone โปรเจกต์ผ่าน git clone หรือตั้งค่า .github-token เพื่อให้สคริปต์ Push ขึ้น GitHub ได้" -ForegroundColor DarkGray
        }
    }
}

# 2. ค้นหาแหล่งข้อมูล Web Server (Localhost -> Render -> GitHub / Local File)
$apiUrls = @($WebUrl, "http://localhost:3000", "https://noir-cream-shop.onrender.com") | Select-Object -Unique
$activeWebUrl = $null

function Invoke-WebGetText {
    param(
        [string]$Uri,
        [int]$TimeoutSec = 10,
        [string]$IfNoneMatch = ""
    )
    $req = [System.Net.HttpWebRequest]::Create($Uri)
    $req.Method = "GET"
    $req.Timeout = $TimeoutSec * 1000
    $req.ReadWriteTimeout = $TimeoutSec * 1000
    $req.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
    $req.UserAgent = "NoirCreamShop-PSSync/2.0"
    if ($IfNoneMatch) {
        $req.Headers.Add("If-None-Match", "`"$IfNoneMatch`"")
    }
    try {
        $resp = [System.Net.HttpWebResponse]$req.GetResponse()
        try {
            $sr = New-Object System.IO.StreamReader($resp.GetResponseStream(), [System.Text.Encoding]::UTF8)
            $body = $sr.ReadToEnd()
            $sr.Dispose()
            return @{ Status = [int]$resp.StatusCode; Body = $body }
        } finally {
            $resp.Close()
        }
    } catch [System.Net.WebException] {
        $httpResp = $_.Exception.Response
        if ($httpResp) {
            $code = [int]$httpResp.StatusCode
            $httpResp.Close()
            if ($code -eq 304) {
                return @{ Status = 304; Body = "" }
            }
            if ($code -eq 404) {
                return @{ Status = 404; Body = "" }
            }
        }
        throw
    }
}

function Invoke-WebGetJson {
    param(
        [string]$Uri,
        [int]$TimeoutSec = 10,
        [string]$IfNoneMatch = ""
    )
    $res = Invoke-WebGetText -Uri $Uri -TimeoutSec $TimeoutSec -IfNoneMatch $IfNoneMatch
    if ($res.Status -eq 200 -and $res.Body) {
        return @{ Status = 200; Data = ($res.Body | ConvertFrom-Json) }
    }
    return @{ Status = $res.Status; Data = $null }
}

function Find-ActiveWebServer {
    foreach ($u in $apiUrls) {
        try {
            $timeout = if ($u -match '^https://') { 25 } else { 3 }
            $res = Invoke-WebGetJson -Uri "$u/api/sql/checksum" -TimeoutSec $timeout
            if ($res.Status -eq 404) {
                $res = Invoke-WebGetJson -Uri "$u/api/sql/snapshot" -TimeoutSec $timeout
            }
            if ($res.Status -eq 200 -and $res.Data -and $res.Data.checksum) {
                return $u
            }
        } catch {}
    }
    return $null
}

Write-Host "🌐 กำลังค้นหา Web Server (Localhost / Render)..." -ForegroundColor Cyan
$activeWebUrl = Find-ActiveWebServer

# 3. ซิงค์เริ่มต้น (สร้างฐานข้อมูล NoirCreamShop + ตารางครบทั้ง 16 ตาราง + Views + ข้อมูลล่าสุด)
$initialScript = $null
$initialWebSnap = $null

if ($activeWebUrl) {
    Write-Host "🌐 เชื่อมต่อ Web Server แบบ Realtime ที่: $activeWebUrl" -ForegroundColor Green
    $timeout = if ($activeWebUrl -match '^https://') { 20 } else { 8 }
    $instQuery = if ($activeInstance) { "?instance=$([uri]::EscapeDataString($activeInstance))" } else { "" }
    $initialWebSnap = (Invoke-WebGetJson -Uri "$activeWebUrl/api/sql/snapshot$instQuery" -TimeoutSec $timeout).Data
    $initialScript = (Invoke-WebGetText -Uri "$activeWebUrl/api/sql/script" -TimeoutSec $timeout).Body
    if (($activeWebUrl -match '^https://') -and (Test-Path (Join-Path $baseDir "shop.db")) -and (Test-Path $localSqlFile) -and $initialWebSnap -and $initialWebSnap.timestamp) {
        $localTimeMs = Get-LocalSnapshotTimeMs
        $remoteTimeMs = 0
        try { $remoteTimeMs = [DateTimeOffset]::Parse([string]$initialWebSnap.timestamp).ToUnixTimeMilliseconds() } catch {}
        if ($localTimeMs -gt $remoteTimeMs) {
            Write-Host "ℹ️ ข้อมูลในเครื่องใหม่กว่าเซิร์ฟเวอร์ออนไลน์ — ใช้ไฟล์ในเครื่องเป็นหลักเพื่อกันข้อมูลย้อนกลับ" -ForegroundColor Yellow
            $initialScript = [System.IO.File]::ReadAllText($localSqlFile, [System.Text.Encoding]::UTF8)
            $initialWebSnap = $null
        }
    }
} elseif (Test-Path $localSqlFile) {
    Write-Host "📂 ใช้ไฟล์ฐานข้อมูลในเครื่อง: $localSqlFile" -ForegroundColor Yellow
    $initialScript = [System.IO.File]::ReadAllText($localSqlFile, [System.Text.Encoding]::UTF8)
} else {
    Write-Host "☁️ ดึงสคริปต์ฐานข้อมูลล่าสุดจาก GitHub..." -ForegroundColor Yellow
    $initialScript = (Invoke-WebGetText -Uri "$githubRawSqlUrl?t=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -TimeoutSec 15).Body
}

if ($activeInstance -and $initialScript) {
    Write-Host "⏳ กำลังซิงค์ฐานข้อมูล [$DatabaseName] เข้าสู่ $activeInstance ..." -ForegroundColor Cyan
    try {
        Invoke-SqlScriptBatches -ScriptText $initialScript
        $ssmsState = Get-SsmsTablesState
        $lastSsmsChecksum = $ssmsState.Checksum
        Write-Host "🎉 ซิงค์ฐานข้อมูล [$DatabaseName] เข้าสู่ $activeInstance สำเร็จเรียบร้อย!" -ForegroundColor Green
        Write-Host "👉 ในโปรแกรม SSMS: คลิกขวาที่โฟลเดอร์ 'Databases' -> กด 'Refresh' จะพบฐานข้อมูล '$DatabaseName' ทันที" -ForegroundColor Yellow
    } catch {
        $lastSsmsChecksum = ""
        Write-Host "❌ ซิงค์เข้าสู่ SQL Server ไม่สำเร็จ: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    $lastSsmsChecksum = ""
}

$lastWebChecksum = if ($initialWebSnap) { $initialWebSnap.checksum } else { $null }

# หากข้อมูลบน Web ใหม่กว่าไฟล์ในเครื่อง/GitHub ให้บันทึกและ Push ทันทีตั้งแต่เริ่ม
if ($initialWebSnap -and $initialScript) {
    $diskChecksum = Get-LocalSnapshotChecksum
    $localTimeMs = Get-LocalSnapshotTimeMs
    $remoteTimeMs = 0
    try { if ($initialWebSnap.timestamp) { $remoteTimeMs = [DateTimeOffset]::Parse([string]$initialWebSnap.timestamp).ToUnixTimeMilliseconds() } } catch {}
    if (($initialWebSnap.checksum -ne $diskChecksum) -and ($remoteTimeMs -ge $localTimeMs)) {
        Save-WebSnapshotFiles -WebSnap $initialWebSnap -ScriptText $initialScript
        Push-DatabaseToGitHub -Reason "Startup Sync $($initialWebSnap.checksum)"
    }
}

Write-Host ""
if ($Once) {
    exit 0
}

$modeDesc = if ($activeInstance) { "Web <-> SSMS ($activeInstance) + GitHub Auto-Sync" } else { "Web <-> GitHub Auto-Sync" }
Write-Host "🔄 เริ่มโหมดซิงค์แบบ Realtime ($modeDesc) ทุกๆ $IntervalSeconds วินาที (กด Ctrl+C เพื่อหยุด)..." -ForegroundColor Cyan
Write-Host ""

$lastFileHash = if (Test-Path $localSqlFile) { (Get-FileHash $localSqlFile -Algorithm SHA256).Hash } else { "" }
$loopCount = 0

while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    $loopCount++
    $now = (Get-Date).ToString("HH:mm:ss")

    # ลองค้นหา SQL Server เป็นระยะหากตอนแรกยังไม่ได้เปิด
    if (-not $activeInstance -and -not $GitHubOnly -and ($loopCount % 5 -eq 0)) {
        $foundInst = Find-SqlInstance
        if ($foundInst) {
            $activeInstance = $foundInst
            Write-Host "[$now] ✅ พบ SQL Server แล้ว: $activeInstance — กำลังซิงค์ฐานข้อมูลเริ่มต้น..." -ForegroundColor Green
            if ($activeWebUrl) {
                try {
                    $scriptText = (Invoke-WebGetText -Uri "$activeWebUrl/api/sql/script" -TimeoutSec 10).Body
                    if ($scriptText) {
                        Invoke-SqlScriptBatches -ScriptText $scriptText
                        $ssmsState = Get-SsmsTablesState
                        $lastSsmsChecksum = $ssmsState.Checksum
                    }
                } catch {}
            }
        }
    }

    # ตรวจสอบการเชื่อมต่อ Web Server หากตอนแรกยังไม่พบ
    if (-not $activeWebUrl) {
        $activeWebUrl = Find-ActiveWebServer
        if ($activeWebUrl) {
            Write-Host "[$now] 🌐 เชื่อมต่อ Web Server สำเร็จที่ $activeWebUrl" -ForegroundColor Green
        }
    }

    if ($activeWebUrl) {
        try {
            $reqTimeout = if ($activeWebUrl -match '^https://') { 10 } else { 4 }
            $instQuery = if ($activeInstance) { "?instance=$([uri]::EscapeDataString($activeInstance))" } else { "" }
            # 1) ตรวจ checksum แบบประหยัดแบนด์วิดท์ (304 = ไม่มีข้อมูลเปลี่ยนแปลง)
            $chkRes = Invoke-WebGetJson -Uri "$activeWebUrl/api/sql/checksum$instQuery" -TimeoutSec $reqTimeout -IfNoneMatch $lastWebChecksum
            if ($chkRes.Status -eq 404) {
                $chkRes = Invoke-WebGetJson -Uri "$activeWebUrl/api/sql/snapshot$instQuery" -TimeoutSec $reqTimeout -IfNoneMatch $lastWebChecksum
            }
            if ($chkRes.Status -eq 200 -and $chkRes.Data -and ($chkRes.Data.checksum -ne $lastWebChecksum)) {
                $webSnap = if ($chkRes.Data.tables) { $chkRes.Data } else { (Invoke-WebGetJson -Uri "$activeWebUrl/api/sql/snapshot$instQuery" -TimeoutSec $reqTimeout).Data }
                $scriptText = (Invoke-WebGetText -Uri "$activeWebUrl/api/sql/script" -TimeoutSec $reqTimeout).Body
                if ($activeInstance -and $scriptText) {
                    Invoke-SqlScriptBatches -ScriptText $scriptText
                    $ssmsState = Get-SsmsTablesState
                    $lastSsmsChecksum = $ssmsState.Checksum
                    Write-Host "[$now] ⚡ [Web -> SSMS] อัปเดตข้อมูลเข้า $activeInstance/$DatabaseName สำเร็จ (Checksum: $($webSnap.checksum))" -ForegroundColor Green
                } else {
                    Write-Host "[$now] ⚡ [Web Change] ตรวจพบการแก้ไขข้อมูลบนเว็บ (Checksum: $($webSnap.checksum))" -ForegroundColor Green
                }
                Save-WebSnapshotFiles -WebSnap $webSnap -ScriptText $scriptText
                $lastWebChecksum = $webSnap.checksum
                if (Test-Path $localSqlFile) { $lastFileHash = (Get-FileHash $localSqlFile -Algorithm SHA256).Hash }
                Push-DatabaseToGitHub -Reason "Web Update $($webSnap.checksum)"
                continue
            }

            # 2) ตรวจว่ามีการแก้ไขข้อมูลโดยตรงใน SSMS หรือไม่ (SSMS -> Web -> GitHub)
            if ($activeInstance) {
                $currentSsms = Get-SsmsTablesState
                if ($currentSsms -and -not $lastSsmsChecksum) {
                    $lastSsmsChecksum = $currentSsms.Checksum
                } elseif ($currentSsms -and ($currentSsms.Checksum -ne $lastSsmsChecksum)) {
                    $bodyJson = (@{
                        instance = $activeInstance
                        database = $DatabaseName
                        tables   = $currentSsms.Tables
                    } | ConvertTo-Json -Depth 6 -Compress)
                    $pushResp = Invoke-RestMethod -Uri "$activeWebUrl/api/sql/push" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($bodyJson)) -ContentType "application/json; charset=utf-8" -TimeoutSec 12 -ErrorAction Stop
                    $lastSsmsChecksum = $currentSsms.Checksum
                    $lastWebChecksum = $pushResp.checksum
                    Write-Host "[$now] 🔄 [SSMS -> Web] ซิงค์ข้อมูลที่แก้ไขใน SSMS ขึ้นหน้าเว็บสำเร็จ! (Checksum: $($pushResp.checksum))" -ForegroundColor Magenta
                    $freshSnap = (Invoke-WebGetJson -Uri "$activeWebUrl/api/sql/snapshot?instance=$([uri]::EscapeDataString($activeInstance))" -TimeoutSec 10).Data
                    $scriptText = (Invoke-WebGetText -Uri "$activeWebUrl/api/sql/script" -TimeoutSec 10).Body
                    Save-WebSnapshotFiles -WebSnap $freshSnap -ScriptText $scriptText
                    if (Test-Path $localSqlFile) { $lastFileHash = (Get-FileHash $localSqlFile -Algorithm SHA256).Hash }
                    Push-DatabaseToGitHub -Reason "SSMS Update $($pushResp.checksum)"
                }
            }
        } catch {
            # หากเซิร์ฟเวอร์รีสตาร์ทหรือหยุดชั่วคราว
        }
    } elseif ($activeInstance -and (Test-Path $localSqlFile)) {
        # โหมดเฝ้าดูไฟล์ NoirCreamShop_SQLServer.sql ในโฟลเดอร์
        $curHash = (Get-FileHash $localSqlFile -Algorithm SHA256).Hash
        if ($curHash -ne $lastFileHash) {
            $scriptText = [System.IO.File]::ReadAllText($localSqlFile, [System.Text.Encoding]::UTF8)
            Invoke-SqlScriptBatches -ScriptText $scriptText
            $lastFileHash = $curHash
            Write-Host "[$now] ⚡ [File -> SSMS] อัปเดตฐานข้อมูล $activeInstance/$DatabaseName จากไฟล์ SQL สำเร็จ!" -ForegroundColor Green
            Push-DatabaseToGitHub -Reason "SQL File Update"
        }
    }
}
