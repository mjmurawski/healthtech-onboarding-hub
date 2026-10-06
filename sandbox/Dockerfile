FROM postgres:14-bullseye

# Instalacja Wine oraz podstawowych narzędzi administracyjnych
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
      wine \
      wine32 \
      wine64 \
      openssh-client \
      sudo \
      nano \
      procps \
      net-tools \
      curl && \
    rm -rf /var/lib/apt/lists/*

# Utworzenie użytkownika i grupy lab:users
RUN groupadd -g 1000 users || true && \
    useradd -u 1000 -m -s /bin/bash -g users -G sudo lab && \
    echo 'lab:lab' | chpasswd && \
    echo 'postgres:postgres' | chpasswd

# Przygotowanie struktury katalogów LIS Marcel
RUN mkdir -p /home/lab/marcel/service && \
    mkdir -p /home/lab/marcel/satellite_keys && \
    chown -R lab:users /home/lab

WORKDIR /home/lab/marcel
