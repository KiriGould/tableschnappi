FROM python:3.11-slim

WORKDIR /app

# garak powers the optional /garak/run sweep. It is OFF by default: garak
# depends on torch and roughly doubles what is otherwise a ~1.2GB application
# image, for a feature the chart does not use — the Helm sweep runs the
# dedicated packages/garak image instead.
#
# Turn it on with --build-arg INCLUDE_GARAK=true if you want /garak/run served
# from this container. Without it the endpoint returns a clear 501.
ARG INCLUDE_GARAK=false

# requirements-garak.txt is a complete set (base + garak), not an overlay, so
# when garak is wanted it replaces the base pins rather than adding to them.
# Both files are committed; see requirements-garak.in for how they are
# regenerated and why it has to be uv rather than pip-compile.
COPY requirements*.txt ./

# The CPU index supplies torch==*+cpu, which is only published there. It keeps
# the CUDA runtime — 13 nvidia-* packages plus triton, several GB — out of an
# image that never loads a model locally: garak is invoked with
# --model_type=openai against a remote endpoint.
RUN if [ "$INCLUDE_GARAK" = "true" ]; then \
      pip install --no-cache-dir \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements-garak.txt; \
    else \
      pip install --no-cache-dir -r requirements.txt; \
    fi

COPY app.py .

# garak writes a user config at import time, so it cannot even be imported
# when HOME is unwritable — and OpenShift runs this as an arbitrary UID with
# no /etc/passwd entry, where HOME defaults to "/". Without this every probe
# died with PermissionError: '/.config' before sending a single prompt.
# Harmless when INCLUDE_GARAK=false. Same treatment as packages/garak.
ENV HOME=/tmp/garak \
    XDG_CONFIG_HOME=/tmp/garak/.config \
    XDG_DATA_HOME=/tmp/garak/.local/share \
    XDG_CACHE_HOME=/tmp/garak/.cache

# OpenShift: arbitrary UID support
RUN mkdir -p /tmp/garak/.config /tmp/garak/.local/share /tmp/garak/.cache && \
    chown -R 1001:0 /app /tmp/garak && \
    chmod -R g=u /app /tmp/garak

EXPOSE 8000
USER 1001
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
