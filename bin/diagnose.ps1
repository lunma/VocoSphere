# Tauri 应用诊断脚本（Windows PowerShell）
$ErrorActionPreference = "SilentlyContinue"

$EXPECTED_NODE = "22.21.1"
$EXPECTED_PNPM = "10.23.0"
$EXPECTED_RUST = "1.91.1"

Write-Host "Tauri 应用诊断工具"
Write-Host "===================="
Write-Host ""

function Get-MajorVersion($ver) { ($ver -split '\.')[0] }

# mise
Write-Host "检查 mise（工具链管理）..."
if (Get-Command mise -ErrorAction SilentlyContinue) {
    $miseVer = (mise --version 2>$null | Select-Object -First 1) ?? "已安装"
    Write-Host "  [OK] mise 已安装: $miseVer"
    if (Test-Path ".mise.toml") {
        Write-Host "  [OK] .mise.toml 配置文件存在"
        Write-Host "  提示: 运行 'mise install' 自动安装所需工具版本"
    } else {
        Write-Host "  [WARN] .mise.toml 配置文件不存在"
    }
} else {
    Write-Host "  [WARN] mise 未安装（推荐使用）"
    Write-Host "         安装: winget install jdx.mise"
    Write-Host "         文档: https://mise.jdx.dev/"
}
Write-Host ""

# Node.js
Write-Host "检查 Node.js..."
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = (node --version).TrimStart('v')
    $nodeMajor = Get-MajorVersion $nodeVer
    $expectedMajor = Get-MajorVersion $EXPECTED_NODE
    if ($nodeMajor -eq $expectedMajor) {
        Write-Host "  [OK] Node.js 已安装: v$nodeVer（期望: v$EXPECTED_NODE）"
    } else {
        Write-Host "  [WARN] Node.js 版本不匹配: v$nodeVer（期望: v$EXPECTED_NODE）"
        Write-Host "         建议: 运行 'mise install'"
    }
} else {
    Write-Host "  [FAIL] Node.js 未安装（期望: v$EXPECTED_NODE）"
    Write-Host "         安装: https://nodejs.org/"
}
Write-Host ""

# pnpm
Write-Host "检查 pnpm..."
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pnpmVer = pnpm --version
    $pnpmMajor = Get-MajorVersion $pnpmVer
    $expectedMajor = Get-MajorVersion $EXPECTED_PNPM
    if ($pnpmMajor -eq $expectedMajor) {
        Write-Host "  [OK] pnpm 已安装: v$pnpmVer（期望: v$EXPECTED_PNPM）"
    } else {
        Write-Host "  [WARN] pnpm 版本不匹配: v$pnpmVer（期望: v$EXPECTED_PNPM）"
        Write-Host "         建议: 运行 'mise install'"
    }
} else {
    Write-Host "  [FAIL] pnpm 未安装（期望: v$EXPECTED_PNPM）"
    Write-Host "         安装: npm install -g pnpm@$EXPECTED_PNPM"
}
Write-Host ""

# Rust
Write-Host "检查 Rust..."
if (Get-Command rustc -ErrorAction SilentlyContinue) {
    $rustVer = (rustc --version) -replace 'rustc ', '' -replace ' .*', ''
    $rustMajor = Get-MajorVersion $rustVer
    $expectedMajor = Get-MajorVersion $EXPECTED_RUST
    if ($rustMajor -eq $expectedMajor) {
        Write-Host "  [OK] Rust 已安装: $rustVer（期望: $EXPECTED_RUST）"
    } else {
        Write-Host "  [WARN] Rust 版本不匹配: $rustVer（期望: $EXPECTED_RUST）"
        Write-Host "         建议: 运行 'mise install'"
    }
} else {
    Write-Host "  [FAIL] Rust 未安装（期望: $EXPECTED_RUST）"
    Write-Host "         安装: https://www.rust-lang.org/tools/install"
}

if (Get-Command cargo -ErrorAction SilentlyContinue) {
    $cargoVer = (cargo --version) -replace 'cargo ', '' -replace ' .*', ''
    Write-Host "  [OK] Cargo 已安装: $cargoVer"
} else {
    Write-Host "  [FAIL] Cargo 未安装"
}
Write-Host ""

# Tauri CLI
Write-Host "检查 Tauri CLI..."
if ((Get-Command pnpm -ErrorAction SilentlyContinue) -and (Test-Path "node_modules")) {
    $tauriVer = (pnpm tauri --version 2>$null | Select-Object -First 1)
    if ($tauriVer) {
        Write-Host "  [OK] Tauri CLI 可用: $tauriVer"
    } else {
        Write-Host "  [FAIL] Tauri CLI 不可用"
        Write-Host "         运行: pnpm install"
    }
} else {
    Write-Host "  [WARN] 无法检查 Tauri CLI（需要先安装依赖）"
    Write-Host "         运行: pnpm install"
}
Write-Host ""

# 依赖
Write-Host "检查项目依赖..."
if (Test-Path "node_modules") {
    Write-Host "  [OK] node_modules 存在"
} else {
    Write-Host "  [FAIL] node_modules 不存在，运行: pnpm install"
}
Write-Host ""

# 配置文件
Write-Host "检查项目配置..."
$configOk = $true
foreach ($f in @("src-tauri\tauri.conf.json", "src-tauri\Cargo.toml", "package.json")) {
    if (Test-Path $f) {
        Write-Host "  [OK] $f 存在"
    } else {
        Write-Host "  [FAIL] $f 不存在"
        $configOk = $false
    }
}
Write-Host ""

# 摘要
Write-Host "===================="
Write-Host "诊断总结"
Write-Host "===================="
Write-Host ""

$hasIssues = -not (
    (Get-Command node  -ErrorAction SilentlyContinue) -and
    (Get-Command pnpm  -ErrorAction SilentlyContinue) -and
    (Get-Command rustc -ErrorAction SilentlyContinue) -and
    (Test-Path "node_modules") -and
    $configOk
)

if ($hasIssues) {
    Write-Host "  [WARN] 检测到问题，请先解决后再启动应用"
    Write-Host ""
    Write-Host "  快速修复："
    Write-Host "    1. mise install      # 安装工具链"
    Write-Host "    2. pnpm install      # 安装前端依赖"
    Write-Host "    3. pnpm tauri dev    # 启动开发服务器"
} else {
    Write-Host "  [OK] 所有基础检查通过！"
    Write-Host ""
    Write-Host "  启动应用: pnpm tauri dev"
}

Write-Host ""
Write-Host "重要提示:"
Write-Host "  不要使用 'pnpm dev'（只启动 Vite，无 Tauri 环境）"
Write-Host "  必须使用 'pnpm tauri dev'"
Write-Host "  首次运行需编译 Rust 代码，可能需要几分钟"
Write-Host ""
