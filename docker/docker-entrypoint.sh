#!/bin/sh

set -e

/usr/docker/wait-for-it.sh $TYPEORM_HOST:${TYPEORM_PORT:-5432}

exec "$@"
