#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/grantfitfuel/patchandpot.git"
BRANCH="audio-pilots-internal"

echo "Cloning Patch and Pot repo..."
git clone "$REPO_URL"
cd patchandpot

echo "Creating branch: $BRANCH"
git checkout -b "$BRANCH"

echo "Creating folders and placeholders..."
mkdir -p audio/pilot/transcripts assets/covers/audio-pilot
printf "Internal pilot audio. Not for public release.\n" > audio/pilot/README.md
printf "Covers for pilot episodes.\n" > assets/covers/audio-pilot/README.md

echo "Adding robots.txt rule (belt-and-braces)..."
cat > robots.txt <<'EOF'
User-agent: *
Disallow: /audio/
EOF

# If site uses Jekyll, exclude pilot folders from build
if [ -f _config.yml ]; then
  echo "Updating _config.yml to exclude pilot folders from build..."
  # If exclude: block doesn't exist, add one
  if ! grep -q "^exclude:" _config.yml; then
    printf "\nexclude:\n  - audio/pilot\n  - assets/covers/audio-pilot\n" >> _config.yml
  else
    # Ensure both paths are listed
    grep -q "audio/pilot" _config.yml || printf "  - audio/pilot\n" >> _config.yml
    grep -q "assets/covers/audio-pilot" _config.yml || printf "  - assets/covers/audio-pilot\n" >> _config.yml
  fi
fi

echo "Committing and pushing branch..."
git add .
git commit -m "chore: add internal-only pilot audio structure + Jekyll exclude + robots.txt"
git push -u origin "$BRANCH"

cat <<'NEXT'
Done.

Now open a DRAFT pull request on GitHub from 'audio-pilots-internal' -> 'main' with title:
  Internal – do not merge (Pilot audio)

Then upload pilot files into:
  audio/pilot/*.mp3 and *.wav
  audio/pilot/transcripts/*.txt
  assets/covers/audio-pilot/*.png

Remember: these folders are excluded from the live site until you approve and merge.
NEXT
