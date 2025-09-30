FROM nginx:stable-alpine

# Copy Nginx config (paths are relative to the nginx/ build context)
COPY conf.d/default.conf /etc/nginx/conf.d/default.conf

# Copy SSL certs directory
COPY certs /etc/nginx/certs
