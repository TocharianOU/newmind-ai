FROM electronuserland/builder:wine

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (Linux build) so download-python-via-uv.ts can run on this container
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

COPY . .

RUN npm ci

ENV WINEARCH=win64
ENV WINEDEBUG=-all

CMD ["npm", "run", "package:windows"]