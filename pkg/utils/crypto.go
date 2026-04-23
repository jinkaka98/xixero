package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"golang.org/x/crypto/pbkdf2"
)

const encPrefix = "enc:"

func getMachineID() (string, error) {
	switch runtime.GOOS {
	case "windows":
		out, err := exec.Command("powershell", "-Command",
			"(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid",
		).Output()
		if err != nil {
			return "", fmt.Errorf("get machine guid: %w", err)
		}
		return strings.TrimSpace(string(out)), nil
	case "linux":
		data, err := os.ReadFile("/etc/machine-id")
		if err != nil {
			return "", err
		}
		return strings.TrimSpace(string(data)), nil
	default:
		host, _ := os.Hostname()
		user := os.Getenv("USER")
		if user == "" {
			user = os.Getenv("USERNAME")
		}
		return host + ":" + user, nil
	}
}

func deriveKey(salt []byte) ([]byte, error) {
	machineID, err := getMachineID()
	if err != nil {
		return nil, err
	}
	return pbkdf2.Key([]byte(machineID), salt, 100_000, 32, sha256.New), nil
}

func Encrypt(plaintext string) (string, error) {
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", err
	}

	key, err := deriveKey(salt)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	combined := append(salt, ciphertext...)
	return encPrefix + base64.StdEncoding.EncodeToString(combined), nil
}

func Decrypt(encrypted string) (string, error) {
	if !strings.HasPrefix(encrypted, encPrefix) {
		return encrypted, nil
	}

	data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(encrypted, encPrefix))
	if err != nil {
		return "", err
	}

	if len(data) < 16 {
		return "", fmt.Errorf("invalid encrypted data")
	}

	salt := data[:16]
	ciphertext := data[16:]

	key, err := deriveKey(salt)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("invalid ciphertext")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt failed: %w", err)
	}

	return string(plaintext), nil
}

func IsEncrypted(s string) bool {
	return strings.HasPrefix(s, encPrefix)
}
