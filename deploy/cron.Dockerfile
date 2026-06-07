# 1MoreRep cron sidecar.
# supercronic (a crond that runs a committed crontab) + curl, both baked in so
# there is no boot-time package install. Alpine gives us curl, ca-certificates
# and /bin/sh (the shell supercronic uses to run each crontab line).
FROM alpine:3.21

# Pinned supercronic release. Multi-arch: the binary + its published SHA1 are
# selected by the build platform's architecture (TARGETARCH is injected by
# BuildKit), so the same Dockerfile builds on amd64 and arm64 hosts.
ARG SUPERCRONIC_VERSION=v0.2.34
ARG SUPERCRONIC_SHA1SUM_amd64=e8631edc1775000d119b70fd40339a7238eece14
ARG SUPERCRONIC_SHA1SUM_arm64=4ab6343b52bf9da592e8b4bb7ae6eb5a8e21b71e
ARG TARGETARCH

RUN set -eu; \
  case "$TARGETARCH" in \
    amd64) sha="$SUPERCRONIC_SHA1SUM_amd64" ;; \
    arm64) sha="$SUPERCRONIC_SHA1SUM_arm64" ;; \
    *) echo "unsupported architecture: ${TARGETARCH:-unknown}" >&2; exit 1 ;; \
  esac; \
  apk add --no-cache curl ca-certificates; \
  curl -fsSLo /usr/local/bin/supercronic \
    "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${TARGETARCH}"; \
  echo "${sha}  /usr/local/bin/supercronic" | sha1sum -c -; \
  chmod +x /usr/local/bin/supercronic

# Run as an unprivileged system user; supercronic needs no root. Use -S (system,
# auto-assigned id) to avoid hard-coded GID/UID collisions with the base image.
RUN addgroup -S cronjobs && adduser -S -G cronjobs cronjobs
USER cronjobs

ENTRYPOINT ["/usr/local/bin/supercronic"]
CMD ["/etc/crontab"]
