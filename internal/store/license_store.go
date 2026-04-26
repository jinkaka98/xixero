package store

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"strings"
	"time"

	bolt "go.etcd.io/bbolt"
)

type License struct {
	Key           string    `json:"key"`
	Name          string    `json:"name"`
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	Revoked       bool      `json:"revoked"`
	LastValidated time.Time `json:"last_validated,omitempty"`
	MachineID     string    `json:"machine_id,omitempty"`
}

func (s *Store) CreateLicense(name string, duration time.Duration) (*License, error) {
	key, err := generateLicenseKey()
	if err != nil {
		return nil, err
	}

	lic := &License{
		Key:       key,
		Name:      name,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(duration),
		Revoked:   false,
	}

	data, err := json.Marshal(lic)
	if err != nil {
		return nil, err
	}

	err = s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketLicenses).Put([]byte(key), data)
	})
	if err != nil {
		return nil, fmt.Errorf("save license: %w", err)
	}

	return lic, nil
}

func (s *Store) GetLicense(key string) (*License, error) {
	var lic License
	err := s.db.View(func(tx *bolt.Tx) error {
		data := tx.Bucket(bucketLicenses).Get([]byte(key))
		if data == nil {
			return fmt.Errorf("license not found: %s", key)
		}
		return json.Unmarshal(data, &lic)
	})
	if err != nil {
		return nil, err
	}
	return &lic, nil
}

func (s *Store) ValidateLicense(key string, machineID string) (*License, error) {
	lic, err := s.GetLicense(key)
	if err != nil {
		return nil, fmt.Errorf("invalid license key")
	}

	if lic.Revoked {
		return nil, fmt.Errorf("license has been revoked")
	}

	if time.Now().After(lic.ExpiresAt) {
		return nil, fmt.Errorf("license expired")
	}

	lic.LastValidated = time.Now()
	if machineID != "" {
		lic.MachineID = machineID
	}

	data, _ := json.Marshal(lic)
	s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketLicenses).Put([]byte(key), data)
	})

	return lic, nil
}

func (s *Store) RevokeLicense(key string) error {
	lic, err := s.GetLicense(key)
	if err != nil {
		return err
	}

	lic.Revoked = true
	data, _ := json.Marshal(lic)

	return s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketLicenses).Put([]byte(key), data)
	})
}

func (s *Store) ListLicenses() ([]License, error) {
	var licenses []License
	err := s.db.View(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketLicenses).ForEach(func(k, v []byte) error {
			var lic License
			if err := json.Unmarshal(v, &lic); err != nil {
				return err
			}
			licenses = append(licenses, lic)
			return nil
		})
	})
	return licenses, err
}

const base32Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func generateLicenseKey() (string, error) {
	raw := make([]byte, 15)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}

	encoded := encodeBase32Custom(raw)
	if len(encoded) < 15 {
		encoded = encoded + strings.Repeat("A", 15-len(encoded))
	}

	seg1 := encoded[0:5]
	seg2 := encoded[5:10]
	seg3 := encoded[10:15]

	payload := seg1 + seg2 + seg3
	checksum := crc32.ChecksumIEEE([]byte(payload))
	checksumBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(checksumBytes, checksum)
	checksumStr := encodeBase32Custom(checksumBytes)
	if len(checksumStr) < 5 {
		checksumStr = checksumStr + strings.Repeat("A", 5-len(checksumStr))
	}

	return fmt.Sprintf("XIXERO-%s-%s-%s-%s", seg1, seg2, seg3, checksumStr[:5]), nil
}

func encodeBase32Custom(data []byte) string {
	var result strings.Builder
	for _, b := range data {
		result.WriteByte(base32Alphabet[int(b)%len(base32Alphabet)])
	}
	return result.String()
}

func ValidateKeyFormat(key string) error {
	parts := strings.Split(key, "-")
	// Accept both XIXERO-XXXXX-XXXXX-XXXXX (4 parts) and XIXERO-XXXXX-XXXXX-XXXXX-XXXXX (5 parts)
	if len(parts) < 4 || parts[0] != "XIXERO" {
		return fmt.Errorf("invalid license key format")
	}
	for i := 1; i < len(parts); i++ {
		if len(parts[i]) < 3 {
			return fmt.Errorf("invalid license key segment")
		}
	}
	return nil
}
