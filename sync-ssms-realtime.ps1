param(
    [string]$ServerInstance = ".\SQLEXPRESS01",
    [string]$DatabaseName = "NoirCreamShop",
    [string]$WebUrl = "http://localhost:3000",
    [int]$IntervalSeconds = 2,
    [switch]$Once
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  NOIR & CREAM — REALTIME SQL SERVER (SSMS) 2-WAY SYNC CONNECTOR" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. ค้นหาและเชื่อมต่อ SQL Server Instance บนเครื่อง (ค่าเริ่มต้น .\SQLEXPRESS01 ตาม SSMS)
$candidates = @($ServerInstance, ".\SQLEXPRESS01", "localhost\SQLEXPRESS01", ".\SQLEXPRESS", "localhost", "(localdb)\MSSQLLocalDB") | Select-Object -Unique
$activeInstance = $null

foreach ($inst in $candidates) {
    try {
        $testConn = New-Object System.Data.SqlClient.SqlConnection("Server=$inst;Database=master;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=3")
        $testConn.Open()
        $testConn.Close()
        $activeInstance = $inst
        break
    } catch {
        continue
    }
}

if (-not $activeInstance) {
    Write-Host "❌ ไม่สามารถเชื่อมต่อ SQL Server Instance (.\SQLEXPRESS01) ได้" -ForegroundColor Red
    Write-Host "   กรุณาตรวจสอบว่าเปิด SQL Server (SQLEXPRESS01) ในบริการ Windows แล้ว" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ เชื่อมต่อ SQL Server สำเร็จ: $activeInstance (Database: [$DatabaseName])" -ForegroundColor Green

function Invoke-SqlScriptBatches {
    param([string]$ScriptText)
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

# 2. ค้นหาแหล่งข้อมูล Web Server (Localhost -> Render -> GitHub / Local File)
$apiUrls = @($WebUrl, "http://localhost:3000", "https://noir-cream-shop.onrender.com") | Select-Object -Unique
$activeWebUrl = $null

foreach ($u in $apiUrls) {
    try {
        $resp = Invoke-RestMethod -Uri "$u/api/sql/snapshot" -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($resp -and $resp.checksum) {
            $activeWebUrl = $u
            break
        }
    } catch {}
}

$baseDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$localSqlFile = Join-Path $baseDir "NoirCreamShop_SQLServer.sql"
$localSnapshotFile = Join-Path $baseDir "db-snapshot.json"
$githubRawSqlUrl = "https://raw.githubusercontent.com/sahapapsir-glitch/noir-cream-shop/main/NoirCreamShop_SQLServer.sql"

function Push-DatabaseToGitHub {
    param([string]$Reason = "Realtime Sync")
    $gitDir = Join-Path $baseDir ".git"
    if (-not (Test-Path $gitDir)) { return }
    try {
        Push-Location $baseDir
        git add "NoirCreamShop_SQLServer.sql" "db-snapshot.json" "shop.db" 2>$null
        $porcelain = git status --porcelain "NoirCreamShop_SQLServer.sql" "db-snapshot.json" "shop.db" 2>$null
        if ($porcelain) {
            git commit -m "Auto-sync database ($Reason) [skip render]" 2>$null | Out-Null
            git push origin main 2>$null | Out-Null
            $sha = (git rev-parse --short HEAD 2>$null)
            Write-Host "   ☁️ [GitHub Sync] อัปเดตข้อมูลขึ้น GitHub สำเร็จ! (Commit: $sha)" -ForegroundColor Cyan
        }
    } catch {} finally {
        Pop-Location
    }
}

# 3. ซิงค์เริ่มต้น (สร้างฐานข้อมูล NoirCreamShop + ตารางครบทั้ง 16 ตาราง + Views + ข้อมูลล่าสุด)
Write-Host "⏳ กำลังสร้างและซิงค์ฐานข้อมูล [$DatabaseName] เข้าสู่ $activeInstance ..." -ForegroundColor Cyan
$initialScript = $null

if ($activeWebUrl) {
    Write-Host "🌐 เชื่อมต่อ Web Server แบบ Realtime ที่: $activeWebUrl" -ForegroundColor Green
    $initialScript = Invoke-RestMethod -Uri "$activeWebUrl/api/sql/script" -Method Get -TimeoutSec 10
} elseif (Test-Path $localSqlFile) {
    Write-Host "📂 ใช้ไฟล์ฐานข้อมูลในเครื่อง: $localSqlFile" -ForegroundColor Yellow
    $initialScript = [System.IO.File]::ReadAllText($localSqlFile, [System.Text.Encoding]::UTF8)
} else {
    Write-Host "☁️ ดึงสคริปต์ฐานข้อมูลล่าสุดจาก GitHub..." -ForegroundColor Yellow
    $initialScript = Invoke-RestMethod -Uri "$githubRawSqlUrl?t=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -Method Get -TimeoutSec 10
}

Invoke-SqlScriptBatches -ScriptText $initialScript
$ssmsState = Get-SsmsTablesState
$lastSsmsChecksum = $ssmsState.Checksum
$lastWebChecksum = $null

if ($activeWebUrl) {
    try {
        $snap = Invoke-RestMethod -Uri "$activeWebUrl/api/sql/snapshot?instance=$([uri]::EscapeDataString($activeInstance))" -Method Get -TimeoutSec 5
        $lastWebChecksum = $snap.checksum
    } catch {}
}

Write-Host ""
Write-Host "🎉 ซิงค์ฐานข้อมูล [$DatabaseName] เข้าสู่ $activeInstance สำเร็จเรียบร้อย!" -ForegroundColor Green
Write-Host "👉 ในโปรแกรม SSMS: คลิกขวาที่โฟลเดอร์ 'Databases' -> กด 'Refresh' จะพบฐานข้อมูล '$DatabaseName' ทันที" -ForegroundColor Yellow
Write-Host ""

if ($Once) {
    exit 0
}

Write-Host "🔄 เริ่มโหมดซิงค์ข้อมูล 2 ทางแบบ Realtime (Web <-> SSMS $activeInstance + GitHub Auto-Sync) ทุกๆ $IntervalSeconds วินาที (กด Ctrl+C เพื่อหยุด)..." -ForegroundColor Cyan
Write-Host ""

$lastFileHash = if (Test-Path $localSqlFile) { (Get-FileHash $localSqlFile -Algorithm SHA256).Hash } else { "" }

while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    $now = (Get-Date).ToString("HH:mm:ss")

    # ตรวจสอบการเชื่อมต่อ Web Server หากเพิ่งเปิด npm start
    if (-not $activeWebUrl) {
        foreach ($u in $apiUrls) {
            try {
                $testSnap = Invoke-RestMethod -Uri "$u/api/sql/snapshot" -Method Get -TimeoutSec 2 -ErrorAction Stop
                if ($testSnap -and $testSnap.checksum) {
                    $activeWebUrl = $u
                    $lastWebChecksum = $testSnap.checksum
                    Write-Host "[$now] 🌐 เชื่อมต่อ Web Server สำเร็จที่ $activeWebUrl" -ForegroundColor Green
                    break
                }
            } catch {}
        }
    }

    if ($activeWebUrl) {
        try {
            # 1) ตรวจว่าหน้าเว็บมีการเปลี่ยนแปลงข้อมูลหรือไม่ (Web -> SSMS -> GitHub)
            $webSnap = Invoke-RestMethod -Uri "$activeWebUrl/api/sql/snapshot?instance=$([uri]::EscapeDataString($activeInstance))" -Method Get -TimeoutSec 4 -ErrorAction Stop
            if ($webSnap.checksum -ne $lastWebChecksum) {
                $scriptText = Invoke-RestMethod -Uri "$activeWebUrl/api/sql/script" -Method Get -TimeoutSec 8 -ErrorAction Stop
                Invoke-SqlScriptBatches -ScriptText $scriptText
                if (Test-Path $baseDir) {
                    [System.IO.File]::WriteAllText($localSqlFile, $scriptText, [System.Text.Encoding]::UTF8)
                    $snapJson = ($webSnap | Select-Object instance, database, timestamp, checksum, counts, tables, views | ConvertTo-Json -Depth 8)
                    [System.IO.File]::WriteAllText($localSnapshotFile, $snapJson, [System.Text.Encoding]::UTF8)
                }
                $lastWebChecksum = $webSnap.checksum
                $ssmsState = Get-SsmsTablesState
                $lastSsmsChecksum = $ssmsState.Checksum
                Write-Host "[$now] ⚡ [Web -> SSMS] อัปเดตข้อมูลเข้า $activeInstance/$DatabaseName สำเร็จ (Checksum: $($webSnap.checksum))" -ForegroundColor Green
                Push-DatabaseToGitHub -Reason "Web Update $($webSnap.checksum)"
                continue
            }

            # 2) ตรวจว่ามีการแก้ไขข้อมูลโดยตรงใน SSMS หรือไม่ (SSMS -> Web -> GitHub)
            $currentSsms = Get-SsmsTablesState
            if ($currentSsms.Checksum -ne $lastSsmsChecksum) {
                $bodyJson = (@{
                    instance = $activeInstance
                    database = $DatabaseName
                    tables   = $currentSsms.Tables
                } | ConvertTo-Json -Depth 6 -Compress)
                $pushResp = Invoke-RestMethod -Uri "$activeWebUrl/api/sql/push" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($bodyJson)) -ContentType "application/json; charset=utf-8" -TimeoutSec 8 -ErrorAction Stop
                $lastSsmsChecksum = $currentSsms.Checksum
                $lastWebChecksum = $pushResp.checksum
                Write-Host "[$now] 🔄 [SSMS -> Web] ซิงค์ข้อมูลที่แก้ไขใน SSMS ขึ้นหน้าเว็บสำเร็จ! (Checksum: $($pushResp.checksum))" -ForegroundColor Magenta
                $scriptText = Invoke-RestMethod -Uri "$activeWebUrl/api/sql/script" -Method Get -TimeoutSec 8 -ErrorAction SilentlyContinue
                if ($scriptText -and (Test-Path $baseDir)) {
                    [System.IO.File]::WriteAllText($localSqlFile, $scriptText, [System.Text.Encoding]::UTF8)
                }
                Push-DatabaseToGitHub -Reason "SSMS Update $($pushResp.checksum)"
            }
        } catch {
            # หากเซิร์ฟเวอร์รีสตาร์ทหรือหยุดชั่วคราว
        }
    } elseif (Test-Path $localSqlFile) {
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
