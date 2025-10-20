FROM python:3.11-slim

WORKDIR /docs

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir mkdocs-material

# Copy project files
COPY . .

# Expose port
EXPOSE 8002

# Set environment variable to disable external API calls
ENV NO_TEMPLATE=true

# Run mkdocs server
CMD ["mkdocs", "serve", "--dev-addr", "0.0.0.0:8002"]

