FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# PostgreSQL 18 from the PostgreSQL Global Development Group (PGDG) apt repository.
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-common ca-certificates make sqlite3 \
 && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
 && apt-get install -y --no-install-recommends postgresql-18 postgresql-contrib-18 postgresql-client-18 \
 && rm -rf /var/lib/apt/lists/*

ENV PATH=/usr/lib/postgresql/18/bin:$PATH
COPY postgresql.labs.conf /etc/postgresql/18/main/conf.d/labs.conf
