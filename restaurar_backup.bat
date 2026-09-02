@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Restaurar backup - Gerador de Fluxograma

set "ORIGEM=%~dp0"
set "ORIGEM=%ORIGEM:~0,-1%"
set "BACKUPS=%ORIGEM%\_backups"

echo ============================================
echo   Restaurar ultimo backup
echo ============================================
echo.

if not exist "%BACKUPS%" (
    echo Nenhum backup encontrado: a pasta _backups nao existe ainda.
    echo Rode primeiro o backup.bat.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-ChildItem -LiteralPath '%BACKUPS%' -Filter backup_*.zip -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"') do set "ULTIMO=%%i"

if "%ULTIMO%"=="" (
    echo Nenhum arquivo de backup encontrado em:
    echo   %BACKUPS%
    echo.
    pause
    exit /b 1
)

echo Backup mais recente encontrado:
echo   %ULTIMO%
echo.
echo ATENCAO: isso vai SOBRESCREVER os arquivos atuais da pasta do projeto
echo com o conteudo desse backup.
echo Arquivos criados DEPOIS do backup, que nao estao nele, NAO serao apagados
echo (apenas os arquivos que existem no backup sao sobrescritos).
echo.
set /p CONFIRMA="Digite S e ENTER para confirmar a restauracao (qualquer outra tecla cancela): "

if /i not "%CONFIRMA%"=="S" (
    echo.
    echo Restauracao cancelada. Nada foi alterado.
    echo.
    pause
    exit /b 0
)

echo.
echo Restaurando...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '%ULTIMO%' -DestinationPath '%ORIGEM%' -Force"

if errorlevel 1 (
    echo.
    echo ============================================
    echo   ERRO ao restaurar o backup.
    echo ============================================
) else (
    echo.
    echo ============================================
    echo   Restauracao concluida a partir de:
    echo   %ULTIMO%
    echo ============================================
)

echo.
pause
