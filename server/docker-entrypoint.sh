#!/bin/sh
set -eu
# A newly mounted persistent disk can mask ownership set when the image was built.
quiz_data_dir="${LEAGUE_DATA_DIR:-/data}"
mkdir -p "$quiz_data_dir"
chown node:node "$quiz_data_dir"
# Only initialization runs as root; the HTTP/OCR process runs as node.
exec gosu node "$@"
