#!/bin/bash

ARCHIVE_NAME="package"
NODE_VERSION="8"
TARGETS="win linux"
ARCHS="x64"
OUT_BIN="out/bin"
OUT_ZIP="out/zip"

rm -rf $OUT_BIN
mkdir -p $OUT_BIN

rm -rf $OUT_ZIP
mkdir -p $OUT_ZIP

cp -r ../tools out/bin

for target in $TARGETS; do
    OUT="$OUT_BIN/$target"

    for arch in $ARCHS; do
        pkg --target node$NODE_VERSION-$target-$arch --output $OUT-$arch ../server/index.js
    done

    zip -r $OUT_ZIP/$ARCHIVE_NAME-$target $OUT_BIN/*$target* $OUT_BIN/tools/*$target*
done

