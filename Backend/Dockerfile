FROM php:8.2-apache

# PostgreSQL-Unterstützung installieren
RUN apt-get update \
    && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql \
    && rm -rf /var/lib/apt/lists/*

# Apache Rewrite-Modul aktivieren
RUN a2enmod rewrite

# Apache-Port
EXPOSE 80