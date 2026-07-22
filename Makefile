.PHONY: engine app dev test clean

# Build the offline engine bundle.
engine:
	./packaging/build-engine.sh

# Build a runnable (unsigned) SenzallsTower.app with the engine embedded.
app: engine
	./packaging/make-app.sh

# Run the engine in a local dev server (browser).
dev:
	cd engine && npm --workspace apps/client run dev:local

# Run engine + app unit tests.
test:
	cd engine && npm test && npx vitest run apps/client/src/local/
	cd app && xcodegen generate >/dev/null && \
	  xcodebuild test -scheme SenzallsTowerTests -destination 'platform=macOS' \
	  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO | tail -3

clean:
	rm -rf build engine/apps/client/dist app/build
