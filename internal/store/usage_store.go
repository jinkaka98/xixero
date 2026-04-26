package store

import (
	"encoding/json"
	"fmt"
	"time"

	bolt "go.etcd.io/bbolt"
)

type UsageRecord struct {
	LicenseKey  string    `json:"license_key"`
	Date        string    `json:"date"`
	Requests    int       `json:"requests"`
	LastRequest time.Time `json:"last_request"`
}

func (s *Store) RecordUsage(licenseKey string) error {
	date := time.Now().Format("2006-01-02")
	key := licenseKey + ":" + date

	return s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketUsage)
		data := b.Get([]byte(key))

		var record UsageRecord
		if data != nil {
			json.Unmarshal(data, &record)
		} else {
			record = UsageRecord{
				LicenseKey: licenseKey,
				Date:       date,
			}
		}

		record.Requests++
		record.LastRequest = time.Now()

		encoded, err := json.Marshal(record)
		if err != nil {
			return err
		}
		return b.Put([]byte(key), encoded)
	})
}

func (s *Store) GetUsage(licenseKey string, days int) ([]UsageRecord, error) {
	var records []UsageRecord

	err := s.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketUsage)
		for i := 0; i < days; i++ {
			date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
			key := licenseKey + ":" + date
			data := b.Get([]byte(key))
			if data != nil {
				var r UsageRecord
				if err := json.Unmarshal(data, &r); err == nil {
					records = append(records, r)
				}
			}
		}
		return nil
	})

	return records, err
}

func (s *Store) GetTotalUsageToday() (int, error) {
	date := time.Now().Format("2006-01-02")
	total := 0

	err := s.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketUsage)
		c := b.Cursor()
		suffix := []byte(":" + date)

		for k, v := c.First(); k != nil; k, v = c.Next() {
			if len(k) > len(suffix) && string(k[len(k)-len(suffix):]) == string(suffix) {
				var r UsageRecord
				if err := json.Unmarshal(v, &r); err == nil {
					total += r.Requests
				}
			}
		}
		return nil
	})

	return total, err
}

func (s *Store) GetAdminCredentials() (username, passwordHash string, err error) {
	err = s.db.View(func(tx *bolt.Tx) error {
		data := tx.Bucket(bucketAdmin).Get([]byte("credentials"))
		if data == nil {
			return fmt.Errorf("admin not initialized")
		}
		var creds struct {
			Username     string `json:"username"`
			PasswordHash string `json:"password_hash"`
		}
		if err := json.Unmarshal(data, &creds); err != nil {
			return err
		}
		username = creds.Username
		passwordHash = creds.PasswordHash
		return nil
	})
	return
}

func (s *Store) SetAdminCredentials(username, passwordHash string) error {
	data, _ := json.Marshal(map[string]string{
		"username":      username,
		"password_hash": passwordHash,
	})
	return s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketAdmin).Put([]byte("credentials"), data)
	})
}
