@echo off
chcp 65001 >nul
echo ============================================================
echo  修复 MySQL 服务：把 --defaults-file 写进服务启动命令
echo  必须以管理员身份运行本脚本（右键 -> 以管理员身份运行）
echo ============================================================
echo.

cd /d "C:\Program Files\MySQL\MySQL Server 8.0\bin"

echo [1/3] 移除现有 MySQL 服务（若存在，忽略报错）...
mysqld --remove MySQL

echo.
echo [2/3] 重新安装 MySQL 服务，显式指定 --defaults-file ...
mysqld --install MySQL --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"

echo.
echo [3/3] 启动 MySQL 服务 ...
net start MySQL

echo.
echo ============================================================
echo 验证：以下命令应返回 MySQL 版本号
echo ============================================================
mysql -uroot -p123456 -e "SELECT VERSION();" 2>nul

echo.
echo 完成。按任意键退出。
pause >nul
