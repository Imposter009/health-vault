@REM Maven wrapper script for Windows.
@echo off
setlocal enabledelayedexpansion

set MAVEN_PROJECTBASEDIR=%~dp0
if "%JAVA_HOME%"=="" (
    set JAVA_CMD=java
) else (
    set JAVA_CMD=%JAVA_HOME%\bin\java.exe
)

set MAVEN_WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar
set MAVEN_WRAPPER_PROPERTIES=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties

if not exist "%MAVEN_WRAPPER_JAR%" (
    for /f "tokens=2 delims==" %%a in ('findstr /i "wrapperUrl" "%MAVEN_WRAPPER_PROPERTIES%"') do set WRAPPER_URL=%%a
    echo Downloading Maven wrapper from !WRAPPER_URL!
    powershell -Command "Invoke-WebRequest -Uri '!WRAPPER_URL!' -OutFile '%MAVEN_WRAPPER_JAR%'" 2>nul
    if errorlevel 1 (
        echo ERROR: Failed to download Maven wrapper. Add Maven to PATH or install curl.
        exit /b 1
    )
)

"%JAVA_CMD%" ^
  -classpath "%MAVEN_WRAPPER_JAR%" ^
  "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" ^
  org.apache.maven.wrapper.MavenWrapperMain %*
