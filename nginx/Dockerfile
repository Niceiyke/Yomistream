FROM nginx:stable-alpine

# Copy Nginx config
COPY nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

# Copy SSL certs
COPY certs /etc/nginx/certs
