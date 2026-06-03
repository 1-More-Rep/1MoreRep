# 1MoreRep cron sidecar.
# supercronic (a crond that runs a committed crontab) + curl, both baked in so
# there is no boot-time package install. Alpine gives us curl, ca-certificates
# and /bin/sh (the shell supercronic uses to run each crontab line).
FROM alpine:3.21

# Pinned supercronic release + its published SHA1 (verified at build time).
ARG SUPERCRONIC_VERSION=v0.2.34
ARG SUPERCRONIC_SHA1SUM=e8631edc1775000d119b70fd40339a7238eece14
ARG SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64

RUN apk add --no-cache curl ca-certificates \
  && curl -fsSLo /usr/local/bin/supercronic "${SUPERCRONIC_URL}" \
  && echo "${SUPERCRONIC_SHA1SUM}  /usr/local/bin/supercronic" | sha1sum -c - \
  && chmod +x /usr/local/bin/supercronic

# Run as an unprivileged user; supercronic needs no root.
RUN addgroup -g 1001 cron && adduser -u 1001 -G cron -D cron
USER cron

ENTRYPOINT ["/usr/local/bin/supercronic"]
CMD ["/etc/crontab"]
