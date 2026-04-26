package main

import (
	"compress/gzip"
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

//go:embed xixero.exe.gz
var embeddedBinary []byte

var (
	Version    = "1.0.2"
	AppName    = "xixero"
	InstallDir = filepath.Join(os.Getenv("LOCALAPPDATA"), "xixero1445")
)

func main() {
	// Check if already installed and just needs to launch
	exePath := filepath.Join(InstallDir, "xixero.exe")
	alreadyInstalled := fileExists(exePath)

	if !alreadyInstalled {
		// First time: install silently
		install()
	} else {
		// Already installed: update binary silently
		_ = extractBinary()
	}

	// Start xixero hidden (no console window) and open browser
	launchHidden(exePath)

	// Small delay to let server start
	time.Sleep(1500 * time.Millisecond)

	// Open browser
	openBrowser("http://localhost:7860")
}

func install() {
	os.MkdirAll(InstallDir, 0o755)

	if err := extractBinary(); err != nil {
		// Silent fail - try to continue
		return
	}

	configurePath()
}

func extractBinary() error {
	exePath := filepath.Join(InstallDir, "xixero.exe")

	if fileExists(exePath) {
		os.Rename(exePath, exePath+".bak")
	}

	reader, err := gzip.NewReader(newBytesReader(embeddedBinary))
	if err != nil {
		return err
	}
	defer reader.Close()

	out, err := os.Create(exePath)
	if err != nil {
		return err
	}
	defer out.Close()

	buf := make([]byte, 32*1024)
	for {
		n, readErr := reader.Read(buf)
		if n > 0 {
			out.Write(buf[:n])
		}
		if readErr != nil {
			break
		}
	}

	os.Remove(exePath + ".bak")
	return nil
}

func configurePath() {
	cmd := exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command",
		fmt.Sprintf(`
			$p = [Environment]::GetEnvironmentVariable("Path", "User")
			if ($p -notlike "*%s*") {
				[Environment]::SetEnvironmentVariable("Path", "%s;$p", "User")
			}
		`, InstallDir, InstallDir))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	cmd.Run()
}

func launchHidden(exePath string) {
	cmd := exec.Command(exePath, "start")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	cmd.Start()
}

func openBrowser(url string) {
	switch runtime.GOOS {
	case "windows":
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		exec.Command("open", url).Start()
	default:
		exec.Command("xdg-open", url).Start()
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// ─── Bytes Reader ───

type bytesReaderT struct {
	data []byte
	pos  int
}

func newBytesReader(data []byte) *bytesReaderT {
	return &bytesReaderT{data: data}
}

func (r *bytesReaderT) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, fmt.Errorf("EOF")
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	if r.pos >= len(r.data) {
		return n, fmt.Errorf("EOF")
	}
	return n, nil
}

// Hide console window on startup
func init() {
	if runtime.GOOS == "windows" {
		// Get console window and hide it
		kernel32 := syscall.NewLazyDLL("kernel32.dll")
		user32 := syscall.NewLazyDLL("user32.dll")
		getConsoleWindow := kernel32.NewProc("GetConsoleWindow")
		showWindow := user32.NewProc("ShowWindow")

		hwnd, _, _ := getConsoleWindow.Call()
		if hwnd != 0 {
			showWindow.Call(hwnd, 0) // SW_HIDE = 0
		}
	}
}

// Ensure unused import
var _ = strings.Contains
