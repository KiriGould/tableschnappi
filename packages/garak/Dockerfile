# Built for linux/amd64 only — that is what OpenShift worker nodes run, and
# requirements.txt is resolved for x86_64 against the PyTorch CPU index. See
# requirements.in for why the CUDA packages are deliberately excluded.
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# OpenShift runs containers under an arbitrary UID that has no entry in
# /etc/passwd, so HOME defaults to "/" and anything resolving a user config
# directory lands on "/.config" — which is not writable. garak creates its
# config dir at import time, so without this it fails before it can run a
# single probe. Point HOME and the XDG dirs somewhere writable.
ENV HOME=/tmp/garak \
    XDG_CONFIG_HOME=/tmp/garak/.config \
    XDG_DATA_HOME=/tmp/garak/.local/share \
    XDG_CACHE_HOME=/tmp/garak/.cache

RUN mkdir -p /tmp/garak/.config /tmp/garak/.local/share /tmp/garak/.cache && \
    chown -R 1001:0 /app /tmp/garak && \
    chmod -R g=rwX /app /tmp/garak

USER 1001
ENTRYPOINT ["python3", "-m", "garak"]
