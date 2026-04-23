.PHONY: build test vet clean dev build-all

build:
	go build -o bin/xixero ./cmd/xixero

build-all:
	GOOS=windows GOARCH=amd64 go build -o bin/xixero-windows-amd64.exe ./cmd/xixero
	GOOS=linux GOARCH=amd64 go build -o bin/xixero-linux-amd64 ./cmd/xixero
	GOOS=darwin GOARCH=amd64 go build -o bin/xixero-darwin-amd64 ./cmd/xixero
	GOOS=darwin GOARCH=arm64 go build -o bin/xixero-darwin-arm64 ./cmd/xixero

test:
	go test -v -race ./...

vet:
	go vet ./...

clean:
	rm -rf bin/

dev:
	go run ./cmd/xixero start
