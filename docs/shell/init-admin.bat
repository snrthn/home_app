@echo off
chcp 65001 >nul
echo ============================================
echo  老马家电 - 初始化默认管理员账号
echo  账号：admin   密码：admin123
echo ============================================
echo.

echo [1/3] 重启 MySQL 服务以应用最新配置...
net stop MySQL
if %errorlevel% neq 0 (
    echo 停止服务失败，可能服务未运行或权限不足。
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
net start MySQL
if %errorlevel% neq 0 (
    echo 启动服务失败，请检查 my.ini 配置。
    pause
    exit /b 1
)
timeout /t 3 /nobreak >nul

echo.
echo [2/3] 执行 init-admin.sql ...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -uroot -p123456 -P3306 < "D:\FrontEnd\home_app\init-admin.sql"
if %errorlevel% neq 0 (
    echo 初始化失败。
    pause
    exit /b 1
)

echo.
echo [3/3] 完成！默认管理员已就绪。
echo.
echo 登录信息：
echo   账号：admin
echo   密码：admin123
echo.
pause
